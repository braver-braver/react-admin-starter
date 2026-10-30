import { apiRequest } from '@/lib/api'
import { successSchema } from '@/lib/contract-schemas'
import { type LoginInput, permissionsSchema, sessionSchema } from './schema'

export const authApi = {
  login: (input: LoginInput) =>
    apiRequest('/api/auth/login', sessionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      handleAuthError: false,
    }),
  session: () =>
    apiRequest('/api/auth/session', sessionSchema, { handleAuthError: false }),
  logout: (csrfToken: string) =>
    apiRequest('/api/auth/logout', successSchema, {
      method: 'POST',
      csrfToken,
      handleAuthError: false,
    }),
  permissions: (signal?: AbortSignal) =>
    apiRequest('/api/auth/permissions', permissionsSchema, { signal }),
}
