import { type z } from 'zod'
import { API_PREFIX, apiErrorSchema, successEnvelope } from '@/contract/common'
import {
  type Operation,
  type OperationId,
  operations,
} from '@/contract/operations'
import { operationBody, operationPath } from '@/contract/request'
import { useAuthStore } from '@/stores/auth-store'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let revision = 0
let onAuthError: ((error: ApiError) => void) | undefined

// Responses belonging to an old account must never affect a new session.
export function invalidateApiRequests() {
  revision += 1
}

export function setAuthErrorHandler(handler: (error: ApiError) => void) {
  onAuthError = handler
}

type ApiOptions = RequestInit & {
  handleAuthError?: boolean
  csrfToken?: string
}

/**
 * `path` is relative to `API_PREFIX` (`/users`, not `/api/v1/users`), so the
 * prefix lives in one place.
 */
export async function apiRequest<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  { handleAuthError = true, csrfToken, ...options }: ApiOptions = {}
): Promise<T> {
  const startedAt = revision
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Requested-With', 'ReactAdminStarter')
  // FormData must keep the browser-generated multipart boundary.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  // Authenticated writes reuse the CSRF token issued with the session.
  const method = (options.method ?? 'GET').toUpperCase()
  const csrf =
    csrfToken ??
    (method === 'GET' ? '' : useAuthStore.getState().auth.csrfToken)
  if (csrf) headers.set('X-CSRF-Token', csrf)
  let response: Response
  try {
    response = await fetch(
      __DEMO_BUILD__
        ? `${import.meta.env.BASE_URL}${API_PREFIX.slice(1)}${path}`
        : `${API_PREFIX}${path}`,
      {
        ...options,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务，请稍后重试。')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body)
    const error = new ApiError(
      response.status,
      parsed.success ? parsed.data.error.code : 'HTTP_ERROR',
      parsed.success
        ? parsed.data.error.message
        : `请求失败（${response.status}）`
    )
    if (
      handleAuthError &&
      startedAt === revision &&
      [401, 403].includes(error.status)
    ) {
      onAuthError?.(error)
    }
    throw error
  }
  if (startedAt !== revision) {
    throw new ApiError(409, 'SESSION_CHANGED', '登录状态已变化，请重新操作。')
  }
  const parsed = successEnvelope(schema).safeParse(body)
  if (!parsed.success) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      '服务返回的数据格式不符合接口契约。'
    )
  }
  return parsed.data.data
}

// ---------------------------------------------------------------- registry

type RegistryOperation = (typeof operations)[number]
type OperationById<Id extends OperationId> = Extract<
  RegistryOperation,
  { id: Id }
>
type InputOf<S> = S extends z.ZodType ? z.input<S> : never

type RequestOptions = {
  signal?: AbortSignal
  handleAuthError?: boolean
  csrfToken?: string
}

/** Arguments of an operation, derived from its registry entry. */
type OperationArgs<Op extends RegistryOperation> =
  (Op['path'] extends `${string}{id}${string}`
    ? { params: { id: string } }
    : { params?: never }) &
    (Op extends { query: infer Q }
      ? { query?: InputOf<Q> }
      : { query?: never }) &
    (Op extends { body: infer B }
      ? { body: InputOf<B> }
      : Op extends { multipart: true }
        ? { body: FormData }
        : { body?: never }) &
    RequestOptions

/** Parsed success data of an operation. */
type OperationResult<Op extends RegistryOperation> = z.output<
  Op['success']['schema']
>

const operationsById = new Map<string, Operation>(
  (operations as readonly Operation[]).map((op) => [op.id, op])
)

function invoke(
  id: OperationId,
  args: {
    params?: Record<string, string>
    query?: Record<string, unknown>
    body?: unknown
  } & RequestOptions
) {
  const op = operationsById.get(id)
  if (!op) throw new Error(`Unknown operation ${id}`)
  return apiRequest(operationPath(op, args), op.success.schema, {
    method: op.method,
    body: operationBody(op, args.body),
    signal: args.signal,
    handleAuthError: args.handleAuthError,
    csrfToken: args.csrfToken,
  })
}

/**
 * Calls a registry operation: the registry supplies the method, the path, how
 * the body is encoded and the success schema; params, query, body and result
 * are typed from the same entry. Auth handling is that of `apiRequest`.
 */
export function callOperation<Id extends OperationId>(
  id: Id,
  ...[args]: object extends OperationArgs<OperationById<Id>>
    ? [args?: OperationArgs<OperationById<Id>>]
    : [args: OperationArgs<OperationById<Id>>]
): Promise<OperationResult<OperationById<Id>>> {
  return invoke(id, (args ?? {}) as Parameters<typeof invoke>[1]) as Promise<
    OperationResult<OperationById<Id>>
  >
}

/**
 * Untyped variant for screens that pick the operation at runtime and validate
 * the body themselves (the generic system-management pages). The response is
 * still checked against the operation's success schema.
 */
export function callOperationUnchecked(
  id: OperationId,
  args: Parameters<typeof invoke>[1] = {}
): Promise<unknown> {
  return invoke(id, args)
}
