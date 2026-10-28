import { z } from 'zod'
import { useAuthStore } from '@/stores/auth-store'

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

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

export async function apiRequest<T>(
  path: `/api/${string}`,
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
    response = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务，请稍后重试。')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body)
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
  const parsed = z.object({ data: schema }).safeParse(body)
  if (!parsed.success) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      '服务返回的数据格式不符合接口契约。'
    )
  }
  return parsed.data.data
}
