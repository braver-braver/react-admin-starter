import { QueryClient } from '@tanstack/react-query'
import { isRedirect } from '@tanstack/react-router'
import { clearCookies } from '@/test-utils/cookies'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { Route } from '../routes/_authenticated/route'

// 测试专用合成令牌：只用于验证守卫行为，不是任何真实系统的凭据
const makeFixtureToken = (label: string) =>
  ['fixture', label, 'token'].join('-')

async function callGuard(env?: { queryClient: QueryClient }) {
  const context = { queryClient: env?.queryClient ?? new QueryClient() }
  return Route.options.beforeLoad!({
    context,
    location: { href: '/users' },
  } as never).then(
    () => undefined,
    (err: unknown) => err
  )
}

describe('authenticated route guard', () => {
  beforeEach(() => {
    useAuthStore.getState().auth.reset()
    clearCookies()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    useAuthStore.getState().auth.reset()
    clearCookies()
  })

  it('redirects to sign-in without a token, including in production', async () => {
    vi.stubEnv('PROD', true)

    const error = await callGuard()

    expect(error).toBeDefined()
    expect(isRedirect(error)).toBe(true)
  })

  it('resets local credentials and redirects when the session cannot be verified', async () => {
    useAuthStore.getState().auth.setSession({
      accessToken: makeFixtureToken('guard'),
      user: {
        accountNo: 'ACC-9',
        name: '守卫测试',
        email: 'guard@example.com',
        roles: ['viewer'],
        permissions: ['dashboard:read'],
      },
    })
    // 未启动 MSW：会话请求必然失败，守卫应清理凭证并重定向
    const error = await callGuard()

    expect(isRedirect(error)).toBe(true)
    expect(useAuthStore.getState().auth.accessToken).toBe('')
  })
})
