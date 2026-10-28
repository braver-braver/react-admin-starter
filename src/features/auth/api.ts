import { z } from 'zod'
import { apiRequest } from '@/lib/api'
import { type LoginInput, sessionSchema } from './schema'

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
    apiRequest('/api/auth/logout', z.object({ success: z.literal(true) }), {
      method: 'POST',
      csrfToken,
      handleAuthError: false,
    }),
  permissions: (signal?: AbortSignal) =>
    apiRequest(
      '/api/auth/permissions',
      z.object({
        roles: z.array(z.string()),
        permissions: z.array(z.string()),
      }),
      { signal }
    ),
}
