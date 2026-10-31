import { apiErrorSchema, successEnvelope } from '@/contract/common'
import { errorCatalog, type ErrorCode } from '@/contract/errors'
import { type Operation, operations } from '@/contract/operations'
import { type SetupWorker } from 'msw/browser'
import { apiBase } from './handlers/auth'

/**
 * Mock contract guard: checks every mocked `/api/v1` response against the
 * operation registry — the status must be declared, a success body must match
 * `{ data: op.success.schema }`, and an error code must be declared for that
 * status. Only `mocks/browser.ts` imports it, so it never reaches the normal
 * production build.
 */

export type ContractViolation = {
  method: string
  path: string
  status: number
  operation?: string
  problem: string
}

const registry: readonly Operation[] = operations
const patterns = registry.map((op) => ({
  op,
  pattern: new RegExp(`^${op.path.replace(/\{\w+\}/g, '[^/]+')}$`),
}))

/** The registry operation that a request to `pathname` hits, if any. */
export function findOperation(
  method: string,
  pathname: string
): Operation | undefined {
  if (!pathname.startsWith(`${apiBase}/`)) return undefined
  const relative = pathname.slice(apiBase.length)
  return patterns.find(
    ({ op, pattern }) => op.method === method && pattern.test(relative)
  )?.op
}

/** Violations found so far; tests assert it stays empty. */
export const contractViolations: ContractViolation[] = []
/** Statuses observed per operation id; tests use it to measure coverage. */
export const observedStatuses = new Map<string, Set<number>>()
const pending = new Set<Promise<void>>()
/** `/api/v1` requests waiting for their response event, by request id. */
const inflight = new Map<string, string>()

function declaredCodes(op: Operation, status: number) {
  return (op.errors as Partial<Record<number, readonly ErrorCode[]>>)[status]
}

async function check(request: Request, response: Response) {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith(`${apiBase}/`)) return
  const method = request.method.toUpperCase()
  const status = response.status
  const body: unknown = await response.json().catch(() => undefined)
  const report = (problem: string, operation?: string) => {
    const violation = { method, path: pathname, status, operation, problem }
    contractViolations.push(violation)
    // Reporting violations in development and demo builds is the point.
    // eslint-disable-next-line no-console
    console.error('[contract-guard]', violation)
  }

  const op = findOperation(method, pathname)
  if (!op) {
    const error = apiErrorSchema.safeParse(body)
    const code = error.success ? error.data.error.code : undefined
    if (!code || !(code in errorCatalog)) {
      report('no registered operation, and the body is not a known error')
    } else if (
      errorCatalog[code as ErrorCode].scope !== 'routing' ||
      !(errorCatalog[code as ErrorCode].status as readonly number[]).includes(
        status
      )
    ) {
      report(`no registered operation; ${code} is not a routing error`)
    }
    return
  }

  const seen = observedStatuses.get(op.id) ?? new Set<number>()
  seen.add(status)
  observedStatuses.set(op.id, seen)

  if (status === op.success.status) {
    const parsed = successEnvelope(op.success.schema).safeParse(body)
    if (!parsed.success) {
      report(
        `success body does not match the contract: ${parsed.error.issues
          .slice(0, 3)
          .map(
            (issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`
          )
          .join('; ')}`,
        op.id
      )
    }
    return
  }
  const codes = declaredCodes(op, status)
  if (!codes) {
    report(`status ${status} is not declared`, op.id)
    return
  }
  const error = apiErrorSchema.safeParse(body)
  if (!error.success) {
    report('error body is not { error: { code, message } }', op.id)
  } else if (!(codes as readonly string[]).includes(error.data.error.code)) {
    report(
      `error code ${error.data.error.code} is not declared for ${status}`,
      op.id
    )
  }
}

/**
 * Waits until every `/api/v1` request seen so far has been answered and
 * checked. `response:mocked` can arrive after `fetch` resolves, so requests
 * are tracked from `request:start`.
 */
export async function settleContractChecks(timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (inflight.size || pending.size) {
    if (Date.now() > deadline) {
      for (const path of inflight.values()) {
        contractViolations.push({
          method: '',
          path,
          status: 0,
          problem: 'no response event within the time limit',
        })
      }
      inflight.clear()
      return
    }
    await Promise.all([...pending])
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

export function resetContractGuard() {
  contractViolations.length = 0
}

export function attachContractGuard(worker: SetupWorker) {
  worker.events.on('request:start', ({ request, requestId }) => {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith(`${apiBase}/`)) inflight.set(requestId, pathname)
  })
  worker.events.on('response:mocked', ({ request, response, requestId }) => {
    const task = check(request.clone(), response.clone()).finally(() =>
      pending.delete(task)
    )
    pending.add(task)
    inflight.delete(requestId)
  })
  // Requests that no handler answered are not the guard's to check.
  worker.events.on('response:bypass', ({ requestId }) => {
    inflight.delete(requestId)
  })
  worker.events.on('unhandledException', ({ requestId }) => {
    inflight.delete(requestId)
  })
}
