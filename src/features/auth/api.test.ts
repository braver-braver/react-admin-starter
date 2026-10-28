import { AxiosError } from 'axios'
import { deriveDemoPassword } from '@/mocks/data/accounts'
import { clearCookies } from '@/test-utils/cookies'
import { resetMockApi, startMockApi, stopMockApi } from '@/test-utils/msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { fetchSession, signIn, signOut } from './api'

describe('auth api (MSW)', () => {
  beforeAll(startMockApi)
  afterAll(stopMockApi)

  afterEach(() => {
    resetMockApi()
    useAuthStore.getState().auth.reset()
    clearCookies()
  })

  it('signs in an admin and returns a session with full permissions', async () => {
    const session = await signIn({
      email: 'admin@example.com',
      password: deriveDemoPassword('admin'),
    })

    expect(session.accessToken).toBeTruthy()
    expect(session.user.email).toBe('admin@example.com')
    expect(session.user.roles).toEqual(['admin'])
    expect(session.user.permissions).toContain('users:write')
  })

  it('rejects wrong credentials with the API error message', async () => {
    await expect(
      signIn({ email: 'admin@example.com', password: 'wrong-pass' })
    ).rejects.toThrow('邮箱或密码错误，请重试。')
  })

  it('returns the session user for a valid token', async () => {
    const session = await signIn({
      email: 'viewer@example.com',
      password: deriveDemoPassword('viewer'),
    })
    useAuthStore.getState().auth.setSession(session)

    const user = await fetchSession()

    expect(user.email).toBe('viewer@example.com')
    expect(user.permissions).not.toContain('users:write')
  })

  it('rejects the session request with 401 when unauthenticated', async () => {
    const error = await fetchSession().catch((err: unknown) => err)

    expect(error).toBeInstanceOf(AxiosError)
    expect((error as AxiosError).response?.status).toBe(401)
  })

  it('signs out without throwing even if the call fails', async () => {
    await expect(signOut()).resolves.toBeUndefined()
  })
})
