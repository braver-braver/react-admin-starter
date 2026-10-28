import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth-store'

const session = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    roles: ['admin'],
    permissions: ['users:read'],
  },
  csrfToken: 'csrf-1',
}

describe('in-memory auth store', () => {
  beforeEach(() => useAuthStore.getState().auth.reset())

  it('starts with no session or browser-readable token', () => {
    const { auth } = useAuthStore.getState()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBe('')
    expect(auth).not.toHaveProperty('accessToken')
    expect(document.cookie).not.toContain('mock-access-token')
  })

  it('stores a server-confirmed session and advances its revision', () => {
    const previous = useAuthStore.getState().auth.revision
    useAuthStore.getState().auth.setSession(session)

    const { auth } = useAuthStore.getState()
    expect(auth.user).toEqual(session.user)
    expect(auth.csrfToken).toBe('csrf-1')
    expect(auth.revision).toBe(previous + 1)
  })

  it('clears identity and CSRF token and advances its revision', () => {
    useAuthStore.getState().auth.setSession(session)
    const previous = useAuthStore.getState().auth.revision
    useAuthStore.getState().auth.reset()

    const { auth } = useAuthStore.getState()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBe('')
    expect(auth.revision).toBe(previous + 1)
  })
})
