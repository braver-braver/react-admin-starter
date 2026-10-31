import { API_PREFIX } from '../common.ts'
import { type Operation, type OperationId, operations } from '../operations.ts'
import { operationBody, operationPath } from '../request.ts'

/** What a scenario sees of one HTTP exchange. */
export type ContractResponse = {
  operation: Operation
  status: number
  headers: Headers
  /** Parsed JSON body; `undefined` when the body is empty or not JSON. */
  body: unknown
}

export type CallArgs = {
  params?: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown
  /**
   * Extra or replaced request headers. `undefined` removes a default header,
   * e.g. `{ 'X-Requested-With': undefined }` to test a missing header.
   */
  headers?: Record<string, string | undefined>
}

/** Sends registry operations to an API and keeps the session between calls. */
export type ContractClient = {
  call(id: OperationId, args?: CallArgs): Promise<ContractResponse>
  /** The CSRF token remembered from the last response carrying a Session. */
  readonly csrfToken: string | undefined
  /**
   * Drops the session (CSRF token and cookies), so the next call starts
   * signed out. `runScenarios` calls it before every scenario.
   */
  forget(): Promise<void>
  /**
   * Save and put back the session cookies; restoring `undefined` drops them
   * without signing out. Only adapters that own their cookies (Node, or the
   * mock harness) offer it; a browser cannot replay an HttpOnly cookie.
   */
  readonly sessionCookies?: {
    save(): string | undefined
    restore(saved: string | undefined): void | Promise<void>
  }
}

/** How a request reaches the API; adapters supply cookie handling. */
export type Transport = {
  send(url: string, init: RequestInit): Promise<Response>
  forget(): void | Promise<void>
}

const byId = new Map<string, Operation>(
  (operations as readonly Operation[]).map((op) => [op.id, op])
)

/** Shared request logic of the browser and Node adapters. */
export function createContractClient(
  baseUrl: string,
  transport: Transport
): ContractClient {
  let csrfToken: string | undefined
  const root = baseUrl.replace(/\/+$/, '')

  return {
    get csrfToken() {
      return csrfToken
    },
    async forget() {
      csrfToken = undefined
      await transport.forget()
    },
    async call(id, args = {}) {
      const op = byId.get(id)
      if (!op) throw new Error(`Unknown operation ${id}`)
      const headers: Record<string, string | undefined> = {
        Accept: 'application/json',
      }
      const body = operationBody(op, args.body)
      if (typeof body === 'string') headers['Content-Type'] = 'application/json'
      if (op.method !== 'GET') headers['X-Requested-With'] = 'ReactAdminStarter'
      if (op.csrf && csrfToken) headers['X-CSRF-Token'] = csrfToken
      Object.assign(headers, args.headers)
      const sent = new Headers()
      for (const [name, value] of Object.entries(headers)) {
        if (value !== undefined) sent.set(name, value)
      }

      const response = await transport.send(
        `${root}${API_PREFIX}${operationPath(op, args)}`,
        { method: op.method, headers: sent, body, redirect: 'manual' }
      )
      const text = await response.text()
      let parsed: unknown
      try {
        parsed = text ? JSON.parse(text) : undefined
      } catch {
        parsed = undefined
      }
      const token = (parsed as { data?: { csrfToken?: unknown } } | undefined)
        ?.data?.csrfToken
      if (response.ok && typeof token === 'string' && token) csrfToken = token
      return {
        operation: op,
        status: response.status,
        headers: response.headers,
        body: parsed,
      }
    },
  }
}
