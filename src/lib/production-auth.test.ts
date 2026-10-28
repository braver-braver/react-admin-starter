import { isRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { Route } from '../routes/_authenticated/route'

const mocks = vi.hoisted(() => ({ loadSession: vi.fn() }))
vi.mock('@/features/auth/session', async (original) => ({
  ...(await original<typeof import('@/features/auth/session')>()),
  loadSession: mocks.loadSession,
}))
afterEach(() => vi.unstubAllEnvs())

describe('production authentication boundary', () => {
  it('redirects direct admin navigation when the server rejects the session', async () => {
    vi.stubEnv('PROD', true)
    mocks.loadSession.mockRejectedValue(
      new ApiError(401, 'UNAUTHENTICATED', '请先登录')
    )
    expect(Route.options.beforeLoad).toBeTypeOf('function')
    let caught: unknown
    try {
      await Route.options.beforeLoad!({ location: { href: '/users' } } as never)
    } catch (error) {
      caught = error
    }
    expect(isRedirect(caught)).toBe(true)
    expect(mocks.loadSession).toHaveBeenCalled()
  })
})
