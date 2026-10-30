import { describe, expect, it } from 'vitest'
import { auditQuerySchema } from './audit.ts'
import {
  USER_FIELDS_REQUIRED,
  userInviteSchema,
  userStatusUpdateSchema,
  userWriteSchema,
  usersQuerySchema,
} from './users.ts'

const validUser = {
  firstName: '安',
  lastName: '李',
  username: 'li_an',
  email: 'li.an@example.com',
  phoneNumber: '+8613800000002',
  role: 'manager',
}

describe('user write schema', () => {
  it('accepts a complete payload and normalises blank optional fields', () => {
    const parsed = userWriteSchema.parse({
      ...validUser,
      departmentId: '  ',
      avatarUrl: '',
    })
    expect(parsed.departmentId).toBeUndefined()
    expect(parsed.avatarUrl).toBeUndefined()
  })

  it('reports blank and missing required fields with the shared message', () => {
    for (const body of [
      { ...validUser, username: '   ' },
      { ...validUser, phoneNumber: undefined },
      { ...validUser, role: '' },
    ]) {
      const result = userWriteSchema.safeParse(body)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(USER_FIELDS_REQUIRED)
    }
  })

  it('rejects bad email, unknown role and short passwords', () => {
    const messages = (body: object) =>
      userWriteSchema.safeParse(body).error?.issues.map((i) => i.message)
    expect(messages({ ...validUser, email: 'nope' })).toContain(
      '邮箱格式不正确。'
    )
    expect(messages({ ...validUser, role: 'root' })).toContain(
      '角色不在允许范围内。'
    )
    expect(messages({ ...validUser, password: 'short' })).toContain(
      '密码至少需要 8 位字符。'
    )
  })
})

describe('user invite and status schemas', () => {
  it('points the first issue at the offending field', () => {
    const email = userInviteSchema.safeParse({ email: 'x', role: 'cashier' })
    expect(email.error?.issues[0].path[0]).toBe('email')
    const role = userInviteSchema.safeParse({ email: 'a@b.co', role: 'root' })
    expect(role.error?.issues[0].path[0]).toBe('role')
    expect(role.error?.issues[0].message).toBe('角色不在允许范围内。')
  })

  it('does not silently coerce an invalid invite role', () => {
    expect(
      userInviteSchema.safeParse({ email: 'a@b.co', role: 'root' }).success
    ).toBe(false)
  })

  it('accepts only active or inactive as a bulk status', () => {
    expect(
      userStatusUpdateSchema.safeParse({ ids: ['1'], status: 'active' }).success
    ).toBe(true)
    const invalid = userStatusUpdateSchema.safeParse({
      ids: ['1'],
      status: 'invited',
    })
    expect(invalid.error?.issues[0].message).toBe('状态只允许启用或停用。')
  })
})

describe('list query schemas', () => {
  it('applies defaults and caps pageSize at 100 (decision D3)', () => {
    expect(usersQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 10,
      sortBy: 'username',
      sortOrder: 'asc',
    })
    expect(usersQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(auditQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(auditQuerySchema.parse({ pageSize: 100 }).pageSize).toBe(100)
  })
})
