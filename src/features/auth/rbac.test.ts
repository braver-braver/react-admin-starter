import { describe, expect, it } from 'vitest'
import { hasAnyPermission, hasPermissions, hasRole } from './rbac'
import { type SessionUser } from './schemas'

const user = (overrides: Partial<SessionUser>): SessionUser => ({
  accountNo: 'ACC-1',
  name: '测试用户',
  email: 'user@example.com',
  roles: ['viewer'],
  permissions: ['dashboard:read', 'users:read'],
  ...overrides,
})

describe('hasPermissions', () => {
  it('returns true when the user has every required permission', () => {
    expect(hasPermissions(user({}), ['dashboard:read', 'users:read'])).toBe(
      true
    )
  })

  it('returns false when any permission is missing', () => {
    expect(hasPermissions(user({}), ['users:write'])).toBe(false)
    expect(hasPermissions(user({}), ['users:read', 'users:write'])).toBe(false)
  })

  it('returns false for null or undefined users', () => {
    expect(hasPermissions(null, ['users:read'])).toBe(false)
    expect(hasPermissions(undefined, ['users:read'])).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('returns true when at least one permission matches', () => {
    expect(hasAnyPermission(user({}), ['users:write', 'users:read'])).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(hasAnyPermission(user({}), ['audit:read', 'users:write'])).toBe(
      false
    )
  })
})

describe('hasRole', () => {
  it('matches any of the given roles', () => {
    expect(hasRole(user({}), ['admin', 'viewer'])).toBe(true)
    expect(hasRole(user({}), ['admin'])).toBe(false)
    expect(hasRole(null, ['admin'])).toBe(false)
  })
})
