import { apiErrorSchema, successEnvelope } from '../common.ts'
import { type ErrorCode } from '../errors.ts'
import { type Operation } from '../operations.ts'

export type CheckResult =
  | { ok: true; kind: 'success'; data: unknown }
  | { ok: true; kind: 'error'; code: ErrorCode }
  | { ok: false; problem: string }

/**
 * Checks one response against its registry operation: the status must be
 * declared, a success body must be `{ data }` matching the success schema,
 * and an error code must be declared for that status.
 */
export function checkResponse(
  op: Operation,
  status: number,
  body: unknown
): CheckResult {
  if (status === op.success.status) {
    const parsed = successEnvelope(op.success.schema).safeParse(body)
    if (parsed.success)
      return { ok: true, kind: 'success', data: parsed.data.data }
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
      .join('; ')
    return {
      ok: false,
      problem: `success body does not match the contract: ${issues}`,
    }
  }
  const codes = (op.errors as Partial<Record<number, readonly ErrorCode[]>>)[
    status
  ]
  if (!codes) return { ok: false, problem: `status ${status} is not declared` }
  const error = apiErrorSchema.safeParse(body)
  if (!error.success) {
    return {
      ok: false,
      problem: 'error body is not { error: { code, message } }',
    }
  }
  const code = error.data.error.code
  if (!(codes as readonly string[]).includes(code)) {
    return {
      ok: false,
      problem: `error code ${code} is not declared for ${status}`,
    }
  }
  return { ok: true, kind: 'error', code: code as ErrorCode }
}
