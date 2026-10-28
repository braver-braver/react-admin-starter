import { useAuthStore } from '@/stores/auth-store'
import { ApiError, invalidateApiRequests } from '@/lib/api'
import { authApi } from './api'
import { type LoginInput, type Session } from './schema'

let pending: Promise<Session> | undefined
let mutationQueue = Promise.resolve()

// Serialize cookie-changing operations: checking a late response cannot undo Set-Cookie.
function mutateSession<T>(action: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(action, action)
  mutationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export async function loadSession() {
  if (pending) return pending
  const revision = useAuthStore.getState().auth.revision
  const request = authApi
    .session()
    .then((session) => {
      if (useAuthStore.getState().auth.revision !== revision) {
        throw new ApiError(401, 'SESSION_CHANGED', '登录状态已变化。')
      }
      useAuthStore.getState().auth.setSession(session)
      return session
    })
    .catch((error: unknown) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        useAuthStore.getState().auth.revision === revision
      ) {
        useAuthStore.getState().auth.reset()
      }
      throw error
    })
    .finally(() => {
      if (pending === request) pending = undefined
    })
  pending = request
  return request
}

export function clearSession() {
  pending = undefined
  invalidateApiRequests()
  useAuthStore.getState().auth.reset()
}

export function signIn(input: LoginInput) {
  return mutateSession(async () => {
    clearSession()
    const session = await authApi.login(input)
    useAuthStore.getState().auth.setSession(session)
    return session
  })
}

export function signOut() {
  const csrfToken = useAuthStore.getState().auth.csrfToken
  return mutateSession(async () => {
    if (useAuthStore.getState().auth.csrfToken !== csrfToken) {
      throw new ApiError(409, 'SESSION_CHANGED', '登录状态已变化，请重新操作。')
    }
    try {
      await authApi.logout(csrfToken)
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    if (useAuthStore.getState().auth.csrfToken !== csrfToken) {
      throw new ApiError(409, 'SESSION_CHANGED', '登录状态已变化，请重新操作。')
    }
    clearSession()
  })
}

export function safeRedirect(target?: string) {
  if (
    !target ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.includes('\\') ||
    /\s/.test(target) ||
    [...target].some((char) => char.charCodeAt(0) < 32)
  )
    return '/'
  const url = new URL(target, window.location.origin)
  if (
    url.origin !== window.location.origin ||
    url.pathname.replace(/\/+$/, '') === '/sign-in'
  )
    return '/'
  return `${url.pathname}${url.search}${url.hash}`
}
