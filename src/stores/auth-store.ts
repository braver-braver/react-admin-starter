import { create } from 'zustand'
import { type Session } from '@/features/auth/schema'

type AuthState = {
  auth: {
    user: Session['user'] | null
    csrfToken: string
    revision: number
    setSession: (session: Session) => void
    reset: () => void
  }
}

// Only server-confirmed identity lives in memory. No browser-readable auth token.
export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    csrfToken: '',
    revision: 0,
    setSession: ({ user, csrfToken }) =>
      set(({ auth }) => ({
        auth: { ...auth, user, csrfToken, revision: auth.revision + 1 },
      })),
    reset: () =>
      set(({ auth }) => ({
        auth: {
          ...auth,
          user: null,
          csrfToken: '',
          revision: auth.revision + 1,
        },
      })),
  },
}))
