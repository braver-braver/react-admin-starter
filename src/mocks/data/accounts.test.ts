import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deriveDemoPassword,
  findDemoAccount,
  issueMockToken,
  resolveMockToken,
  toSessionUser,
} from './accounts'

describe('deriveDemoPassword', () => {
  it('derives the public demo passphrase from the role', () => {
    expect(deriveDemoPassword('admin')).toBe('Admin123456')
    expect(deriveDemoPassword('viewer')).toBe('Viewer123456')
  })
})

describe('findDemoAccount', () => {
  it('matches an account with email and demo passphrase', () => {
    const account = findDemoAccount('admin@example.com', 'Admin123456')
    expect(account?.roles).toEqual(['admin'])
  })

  it('matches emails case-insensitively', () => {
    expect(findDemoAccount('ADMIN@example.com', 'Admin123456')).toBeDefined()
  })

  it('rejects a wrong passphrase or unknown email', () => {
    expect(findDemoAccount('admin@example.com', 'wrong-pass')).toBeUndefined()
    expect(findDemoAccount('nobody@example.com', 'Admin123456')).toBeUndefined()
  })
})

describe('toSessionUser', () => {
  it('unions permissions across roles without duplicates', () => {
    const account = findDemoAccount('admin@example.com', 'Admin123456')!
    const sessionUser = toSessionUser({
      ...account,
      roles: ['operator', 'viewer'],
    })

    expect(new Set(sessionUser.permissions)).toEqual(
      new Set(['dashboard:read', 'users:read', 'users:write'])
    )
  })

  it('grants admin every permission including audit', () => {
    const admin = toSessionUser(findDemoAccount('admin@example.com')!)
    expect(admin.permissions).toContain('audit:read')

    const viewer = toSessionUser(findDemoAccount('viewer@example.com')!)
    expect(viewer.permissions).not.toContain('users:write')
  })
})

describe('mock token', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips an issued token back to the account', () => {
    const account = findDemoAccount('viewer@example.com')!
    const token = issueMockToken(account)

    expect(resolveMockToken(token)?.email).toBe('viewer@example.com')
  })

  it('rejects tokens that have expired', () => {
    vi.useFakeTimers()
    const account = findDemoAccount('viewer@example.com')!
    const token = issueMockToken(account)

    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000)
    expect(resolveMockToken(token)).toBeUndefined()
  })

  it('rejects malformed or foreign tokens', () => {
    expect(resolveMockToken('not-a-mock-token')).toBeUndefined()
    expect(resolveMockToken('mock.####')).toBeUndefined()
    expect(resolveMockToken(undefined)).toBeUndefined()
  })
})
