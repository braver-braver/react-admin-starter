import { describe, expect, it } from 'vitest'
import { auditListResponseSchema, auditLogSchema } from './audit.ts'
import { sessionSchema } from './auth.ts'
import { wireDate } from './common.ts'
import {
  accountCreateInput,
  accountInput,
  accountSchema,
  departmentInput,
  departmentSchema,
  menuInput,
  menuSchema,
  permissionInput,
  permissionSchema,
  roleInput,
  roleSchema,
  systemListOf,
} from './system.ts'
import { userListResponseSchema, userSchema } from './users.ts'

const common = { id: 'x', protected: false }
const records = {
  accounts: {
    schema: accountSchema,
    input: accountInput,
    record: {
      ...common,
      resource: 'accounts',
      name: 'Ada',
      email: 'ada@example.org',
      enabled: true,
      departmentId: 'dept',
      roleIds: ['role'],
    },
  },
  roles: {
    schema: roleSchema,
    input: roleInput,
    record: {
      ...common,
      resource: 'roles',
      name: 'Editor',
      code: 'editor',
      enabled: true,
      permissionIds: ['p'],
      menuIds: ['m'],
      scope: 'department',
      departmentIds: [],
    },
  },
  permissions: {
    schema: permissionSchema,
    input: permissionInput,
    record: {
      ...common,
      resource: 'permissions',
      name: 'Read',
      code: 'users:read',
      description: '',
    },
  },
  menus: {
    schema: menuSchema,
    input: menuInput,
    record: {
      ...common,
      resource: 'menus',
      name: 'Users',
      parentId: '',
      kind: 'page',
      routeId: 'users',
      enabled: true,
      visible: true,
      order: 1,
    },
  },
  departments: {
    schema: departmentSchema,
    input: departmentInput,
    record: {
      ...common,
      resource: 'departments',
      name: 'HQ',
      code: 'hq',
      parentId: '',
      enabled: true,
    },
  },
} as const

const user = {
  id: 'u1',
  firstName: 'A',
  lastName: 'B',
  username: 'ab',
  email: 'ab@example.org',
  phoneNumber: '1',
  status: 'active',
  role: 'admin',
  createdAt: '2026-10-30T10:00:00.000Z',
  updatedAt: '2026-10-30T10:00:00.000Z',
}
const meta = { page: 1, pageSize: 10, total: 1, totalPageCount: 1 }
const log = {
  id: 'a1',
  createdAt: '2026-10-30T10:00:00.000Z',
  actorName: 'A',
  actorEmail: 'a@example.org',
  action: 'auth.sign_in',
  target: 't',
  detail: 'd',
  ip: '127.0.0.1',
}

describe('responses tolerate fields added by a backend', () => {
  for (const [resource, { schema, record }] of Object.entries(records)) {
    it(`parses a ${resource} record with an unknown field and keeps the known ones`, () => {
      const parsed = schema.parse({ ...record, addedLater: 1 })
      expect(parsed).toMatchObject(record)
    })
  }

  it('parses system lists, users, audit logs and sessions with extra fields', () => {
    const list = systemListOf(accountSchema).parse({
      items: [{ ...records.accounts.record, extra: true }],
      meta,
      extra: true,
    })
    expect(list.items).toHaveLength(1)
    expect(userSchema.safeParse({ ...user, extra: 1 }).success).toBe(true)
    expect(
      userListResponseSchema.safeParse({
        items: [user],
        meta: { ...meta, extra: 1 },
        extra: 1,
      }).success
    ).toBe(true)
    expect(auditLogSchema.safeParse({ ...log, extra: 1 }).success).toBe(true)
    expect(
      auditListResponseSchema.safeParse({ items: [log], meta, extra: 1 })
        .success
    ).toBe(true)
    expect(
      sessionSchema.safeParse({
        user: {
          id: 'u',
          email: 'u@example.org',
          name: 'U',
          roles: [],
          permissions: [],
          extra: 1,
        },
        csrfToken: 't',
        extra: 1,
      }).success
    ).toBe(true)
  })
})

describe('system request bodies stay strict', () => {
  const body = {
    accounts: {
      name: 'Ada',
      email: 'ADA@example.org',
      enabled: true,
      departmentId: 'dept',
      roleIds: ['role'],
    },
    roles: {
      name: 'Editor',
      code: 'editor',
      enabled: true,
      permissionIds: [],
      menuIds: [],
      scope: 'self',
      departmentIds: [],
    },
    permissions: { name: 'Read', code: 'users:read', description: '' },
    menus: {
      name: 'Users',
      parentId: '',
      kind: 'page',
      routeId: 'users',
      enabled: true,
      visible: true,
      order: 1,
    },
    departments: { name: 'HQ', code: 'hq', parentId: '', enabled: true },
  } as const

  for (const [resource, { input }] of Object.entries(records)) {
    it(`accepts a valid ${resource} body and rejects one with an unknown field`, () => {
      const valid = body[resource as keyof typeof body]
      expect(input.safeParse(valid).success).toBe(true)
      expect(input.safeParse({ ...valid, extra: 1 }).success).toBe(false)
    })
  }

  it('rejects an unknown field on the create-account body too, and lowercases the email', () => {
    const create = { ...body.accounts, password: 'longenough' }
    expect(accountCreateInput.parse(create).email).toBe('ada@example.org')
    expect(accountCreateInput.safeParse({ ...create, extra: 1 }).success).toBe(
      false
    )
  })
})

describe('timestamps', () => {
  it.each([
    null,
    0,
    1730282400000,
    true,
    false,
    {},
    [],
    undefined,
    'garbage',
    '',
    '2026-13-40T00:00:00Z',
    '2026-10-30',
    '2026-10-30T10:00:00',
  ])('rejects %j', (value) => {
    expect(wireDate.safeParse(value).success).toBe(false)
    expect(userSchema.safeParse({ ...user, createdAt: value }).success).toBe(
      false
    )
    expect(auditLogSchema.safeParse({ ...log, createdAt: value }).success).toBe(
      false
    )
  })

  it.each([
    ['2026-10-30T10:00:00Z', '2026-10-30T10:00:00.000Z'],
    ['2026-10-30T10:00:00.123Z', '2026-10-30T10:00:00.123Z'],
    ['2026-10-30T18:00:00+08:00', '2026-10-30T10:00:00.000Z'],
  ])('parses %s into the matching Date', (value, iso) => {
    const parsed = wireDate.parse(value)
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed.toISOString()).toBe(iso)
  })

  it('turns the string fields of users and audit logs into Date objects', () => {
    expect(userSchema.parse(user).createdAt).toBeInstanceOf(Date)
    expect(auditLogSchema.parse(log).createdAt).toBeInstanceOf(Date)
  })

  it('encodes a Date back to an ISO string', () => {
    expect(wireDate.encode(new Date('2026-10-30T10:00:00Z'))).toBe(
      '2026-10-30T10:00:00.000Z'
    )
  })
})

describe('page metadata is validated, not trusted', () => {
  const valid = { items: [], meta }
  it('accepts consistent metadata', () => {
    expect(userListResponseSchema.safeParse(valid).success).toBe(true)
    expect(systemListOf(accountSchema).safeParse(valid).success).toBe(true)
  })

  it.each([
    ['totalPageCount of 0', { totalPageCount: 0 }],
    ['a fractional totalPageCount', { totalPageCount: 1.5 }],
    ['a negative total', { total: -1 }],
    ['page 0', { page: 0 }],
    ['pageSize above 100', { pageSize: 101 }],
    ['a fractional pageSize', { pageSize: 10.5 }],
  ])('rejects %s in every list envelope', (_label, patch) => {
    const body = { items: [], meta: { ...meta, ...patch } }
    expect(userListResponseSchema.safeParse(body).success).toBe(false)
    expect(auditListResponseSchema.safeParse(body).success).toBe(false)
    expect(systemListOf(accountSchema).safeParse(body).success).toBe(false)
  })
})
