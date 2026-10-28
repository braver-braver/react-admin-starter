import { isRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route } from '../routes/_authenticated/route'

afterEach(() => vi.unstubAllEnvs())

describe('production demo boundary', () => {
  it('redirects direct admin navigation to sign-in in production', () => {
    vi.stubEnv('PROD', true)
    expect(Route.options.beforeLoad).toBeTypeOf('function')
    try {
      Route.options.beforeLoad!({ location: { href: '/users' } } as never)
      expect.fail('Expected the route guard to reject demo access')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
    }
  })
})
