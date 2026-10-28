import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it } from 'vitest'
import { getCookie } from '@/lib/cookies'
import { type SessionUser } from '@/features/auth/schemas'
import { useAuthStore } from './auth-store'

// 注：浏览器测试环境下 vi.resetModules 无法可靠地重建 zustand 模块，
// 因此这里不模拟「刷新重建」，改为直接验证 cookie 持久化契约。

// 测试专用合成令牌：只用于验证持久化行为，不是任何真实系统的凭据
const makeFixtureToken = (label: string) =>
  ['fixture', label, 'token'].join('-')

const sampleUser: SessionUser = {
  accountNo: 'ACC-1',
  name: '测试用户',
  email: 'user@example.com',
  roles: ['viewer'],
  permissions: ['dashboard:read', 'users:read'],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    clearCookies()
    useAuthStore.getState().auth.reset()
  })

  it('starts with an empty access token when nothing is persisted', () => {
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('keeps the session in state and persists the token cookie', () => {
    useAuthStore.getState().auth.setSession({
      accessToken: makeFixtureToken('persisted'),
      user: sampleUser,
    })

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
    expect(useAuthStore.getState().auth.accessToken).toBe(
      makeFixtureToken('persisted')
    )
    // 令牌写入 cookie，刷新后可凭它恢复会话；用户信息不持久化
    expect(getCookie('ras.access-token')).toBe(makeFixtureToken('persisted'))
  })

  it('updates the signed-in user via setUser', () => {
    useAuthStore.getState().auth.setUser(sampleUser)

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
  })

  it('reset clears the user, token and cookie persistence', () => {
    useAuthStore.getState().auth.setSession({
      accessToken: makeFixtureToken('cleared'),
      user: sampleUser,
    })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(getCookie('ras.access-token')).toBeUndefined()
  })
})
