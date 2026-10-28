import { isRedirect } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { requireSession } from './guard'
import { clearSession } from './session'

const session = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    roles: ['reader'],
    permissions: ['users:read'],
  },
  csrfToken: 'csrf-token',
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

async function thrownBy(promise: Promise<unknown>) {
  try {
    await promise
    expect.fail('Expected navigation to be rejected')
  } catch (error) {
    return error
  }
}

describe('requireSession', () => {
  beforeEach(() => clearSession())
  afterEach(() => vi.restoreAllMocks())

  it('accepts server-confirmed identity with the required permission', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(200, { data: session })
    )
    await expect(requireSession('/users', 'users:read')).resolves.toEqual({
      session,
    })
  })

  it('redirects a 401 to sign-in with a safe return path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } })
    )
    const error = await thrownBy(requireSession('/users?page=2'))
    expect(isRedirect(error)).toBe(true)
    expect(error).toMatchObject({
      options: {
        to: '/sign-in',
        search: { redirect: '/users?page=2' },
      },
    })
  })

  it('redirects a server 403 to the forbidden page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(403, { error: { code: 'FORBIDDEN', message: 'denied' } })
    )
    const error = await thrownBy(requireSession('/users', 'users:read'))
    expect(isRedirect(error)).toBe(true)
    expect(error).toMatchObject({ options: { to: '/403' } })
  })

  it('redirects a missing permission without rendering protected content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(200, {
        data: {
          ...session,
          user: { ...session.user, permissions: [] },
        },
      })
    )
    const error = await thrownBy(requireSession('/users', 'users:write'))
    expect(isRedirect(error)).toBe(true)
    expect(error).toMatchObject({ options: { to: '/403' } })
  })

  it('fails closed on 500 instead of treating it as a valid session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response(500, { error: { code: 'SERVER', message: 'failed' } })
    )
    const error = await thrownBy(requireSession('/users'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, code: 'SERVER' })
    expect(isRedirect(error)).toBe(false)
  })
})
