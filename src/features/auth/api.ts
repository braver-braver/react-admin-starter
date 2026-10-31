import { callOperation } from '@/lib/api'
import { type LoginInput } from './schema'

export const authApi = {
  login: (body: LoginInput) =>
    callOperation('login', { body, handleAuthError: false }),
  session: () => callOperation('getSession', { handleAuthError: false }),
  logout: (csrfToken: string) =>
    callOperation('logout', { csrfToken, handleAuthError: false }),
  permissions: (signal?: AbortSignal) =>
    callOperation('getPermissions', { signal }),
}
