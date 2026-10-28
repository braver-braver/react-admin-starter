import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from '@/lib/api'
import { authApi } from './api'
import {
  clearSession,
  loadSession,
  safeRedirect,
  signIn,
  signOut,
} from './session'

const firstSession = {
  user: {
    id: 'first',
    email: 'first@example.com',
    name: 'First User',
    roles: ['admin'],
    permissions: ['users:read'],
  },
  csrfToken: 'csrf-first',
}
const secondSession = {
  user: {
    id: 'second',
    email: 'second@example.com',
    name: 'Second User',
    roles: ['reader'],
    permissions: [],
  },
  csrfToken: 'csrf-second',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('session lifecycle', () => {
  beforeEach(() => clearSession())
  afterEach(() => vi.restoreAllMocks())

  it('rehydrates only from a server-confirmed session', async () => {
    const sessionRequest = vi
      .spyOn(authApi, 'session')
      .mockResolvedValue(firstSession)
    await expect(loadSession()).resolves.toEqual(firstSession)
    expect(sessionRequest).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().auth.user).toEqual(firstSession.user)
    expect(useAuthStore.getState().auth.csrfToken).toBe('csrf-first')
  })

  it('coalesces simultaneous bootstrap requests', async () => {
    const response = deferred<typeof firstSession>()
    const sessionRequest = vi
      .spyOn(authApi, 'session')
      .mockReturnValue(response.promise)
    const a = loadSession()
    const b = loadSession()
    expect(sessionRequest).toHaveBeenCalledOnce()
    response.resolve(firstSession)
    await expect(Promise.all([a, b])).resolves.toEqual([
      firstSession,
      firstSession,
    ])
  })

  it('clears session on 401 but retains it after transient server failure', async () => {
    useAuthStore.getState().auth.setSession(firstSession)
    const sessionRequest = vi.spyOn(authApi, 'session')
    sessionRequest.mockRejectedValueOnce(new ApiError(500, 'SERVER', 'failure'))
    await expect(loadSession()).rejects.toMatchObject({ status: 500 })
    expect(useAuthStore.getState().auth.user).toEqual(firstSession.user)

    sessionRequest.mockRejectedValueOnce(
      new ApiError(401, 'UNAUTHORIZED', 'expired')
    )
    await expect(loadSession()).rejects.toMatchObject({ status: 401 })
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.csrfToken).toBe('')
  })

  it('cannot restore a stale bootstrap after clearSession and a new identity', async () => {
    const oldResponse = deferred<typeof firstSession>()
    const sessionRequest = vi
      .spyOn(authApi, 'session')
      .mockReturnValue(oldResponse.promise)
    const bootstrap = loadSession()
    clearSession()
    useAuthStore.getState().auth.setSession(secondSession)

    oldResponse.resolve(firstSession)
    await expect(bootstrap).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_CHANGED',
    })
    expect(sessionRequest).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().auth.user).toEqual(secondSession.user)
  })

  it('signs in with a server-confirmed identity', async () => {
    const login = vi.spyOn(authApi, 'login').mockResolvedValue(firstSession)
    await expect(
      signIn({ email: 'first@example.com', password: 'example-password' })
    ).resolves.toEqual(firstSession)
    expect(login).toHaveBeenCalledWith({
      email: 'first@example.com',
      password: 'example-password',
    })
    expect(useAuthStore.getState().auth.user).toEqual(firstSession.user)
  })

  it('clears state after successful logout or an already-expired 401', async () => {
    const logout = vi
      .spyOn(authApi, 'logout')
      .mockResolvedValue({ success: true })
    useAuthStore.getState().auth.setSession(firstSession)
    await signOut()
    expect(logout).toHaveBeenCalledWith('csrf-first')
    expect(useAuthStore.getState().auth.user).toBeNull()

    useAuthStore.getState().auth.setSession(secondSession)
    logout.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'expired'))
    await signOut()
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it.each([
    new ApiError(0, 'NETWORK_ERROR', 'offline'),
    new ApiError(403, 'FORBIDDEN', 'denied'),
  ])('retains state when logout fails with %s', async (error) => {
    useAuthStore.getState().auth.setSession(firstSession)
    vi.spyOn(authApi, 'logout').mockRejectedValue(error)
    await expect(signOut()).rejects.toBe(error)
    expect(useAuthStore.getState().auth.user).toEqual(firstSession.user)
    expect(useAuthStore.getState().auth.csrfToken).toBe('csrf-first')
  })

  it('retains state if the server reports an unsuccessful logout', async () => {
    useAuthStore.getState().auth.setSession(firstSession)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { success: false } }), {
        status: 200,
      })
    )
    await expect(signOut()).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
    expect(useAuthStore.getState().auth.user).toEqual(firstSession.user)
  })

  it('does not clear a newer identity when an old logout completes', async () => {
    const oldResponse = deferred<{ success: true }>()
    const logoutApi = vi
      .spyOn(authApi, 'logout')
      .mockReturnValue(oldResponse.promise)
    useAuthStore.getState().auth.setSession(firstSession)
    const logout = signOut()
    await vi.waitFor(() => expect(logoutApi).toHaveBeenCalledWith('csrf-first'))
    useAuthStore.getState().auth.setSession(secondSession)

    oldResponse.resolve({ success: true })
    await expect(logout).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_CHANGED',
    })
    expect(useAuthStore.getState().auth.user).toEqual(secondSession.user)
  })

  it('waits for logout to finish before starting a new login', async () => {
    useAuthStore.getState().auth.setSession(firstSession)
    const logoutResponse = deferred<{ success: true }>()
    const logoutApi = vi
      .spyOn(authApi, 'logout')
      .mockReturnValue(logoutResponse.promise)
    const loginApi = vi.spyOn(authApi, 'login').mockResolvedValue(secondSession)

    const logout = signOut()
    await vi.waitFor(() => expect(logoutApi).toHaveBeenCalledWith('csrf-first'))
    const login = signIn({
      email: 'second@example.com',
      password: 'example-password',
    })
    expect(loginApi).not.toHaveBeenCalled()

    logoutResponse.resolve({ success: true })
    await logout
    await expect(login).resolves.toEqual(secondSession)
    expect(loginApi).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().auth.user).toEqual(secondSession.user)
  })

  it('does not overlap two login requests that can set cookies', async () => {
    const firstResponse = deferred<typeof firstSession>()
    const secondResponse = deferred<typeof secondSession>()
    const loginApi = vi
      .spyOn(authApi, 'login')
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)

    const first = signIn({
      email: 'first@example.com',
      password: 'example-password',
    })
    await vi.waitFor(() => expect(loginApi).toHaveBeenCalledTimes(1))
    const second = signIn({
      email: 'second@example.com',
      password: 'example-password',
    })
    expect(loginApi).toHaveBeenCalledTimes(1)

    firstResponse.resolve(firstSession)
    await expect(first).resolves.toEqual(firstSession)
    await vi.waitFor(() => expect(loginApi).toHaveBeenCalledTimes(2))
    expect(useAuthStore.getState().auth.user).toBeNull()
    secondResponse.resolve(secondSession)
    await expect(second).resolves.toEqual(secondSession)
    expect(useAuthStore.getState().auth.user).toEqual(secondSession.user)
  })

  it('continues the mutation queue after a rejected operation', async () => {
    const failure = new ApiError(401, 'INVALID_CREDENTIALS', 'denied')
    const loginApi = vi
      .spyOn(authApi, 'login')
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(secondSession)

    await expect(
      signIn({ email: 'first@example.com', password: 'wrong-password' })
    ).rejects.toBe(failure)
    await expect(
      signIn({
        email: 'second@example.com',
        password: 'example-password',
      })
    ).resolves.toEqual(secondSession)
    expect(loginApi).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().auth.user).toEqual(secondSession.user)
  })
})

describe('safeRedirect', () => {
  it('retains same-origin relative path, query and hash', () => {
    expect(safeRedirect('/users?page=2#details')).toBe('/users?page=2#details')
  })

  it.each([
    undefined,
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/users\\evil',
    '/users\nheader',
    '/users\tvalue',
    '/sign-in',
    '/sign-in/',
    '/sign-in?redirect=/users',
  ])('rejects an unsafe redirect target %s', (target) => {
    expect(safeRedirect(target)).toBe('/')
  })
})
