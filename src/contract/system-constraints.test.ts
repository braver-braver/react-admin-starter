import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { operations, type Operation } from './operations.ts'

const registry: readonly Operation[] = operations
const writeBodies = registry.filter(
  (op) =>
    op.path.startsWith('/system/') &&
    ['POST', 'PUT'].includes(op.method) &&
    op.body
)
const bodyOf = (id: string) => {
  const body = registry.find((op) => op.id === id)?.body
  if (!body) throw new Error(`no body for ${id}`)
  return body
}
type JsonSchema = {
  type?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: unknown
}
const jsonSchema = (id: string) =>
  z.toJSONSchema(bodyOf(id), { io: 'input' }) as JsonSchema
const prop = (id: string, key: string) => {
  const found = jsonSchema(id).properties?.[key]
  if (!found) throw new Error(`${id} has no ${key}`)
  return found
}

describe('system request bodies, as the generated OpenAPI will see them', () => {
  it('has one concrete body per create and update operation (10 in total)', () => {
    expect(writeBodies).toHaveLength(10)
    const shapes = new Set(
      writeBodies
        .filter((op) => op.method === 'POST')
        .map((op) => Object.keys(jsonSchema(op.id).properties ?? {}).join(','))
    )
    expect(shapes.size).toBe(5)
  })

  it('never needs oneOf/anyOf to pick a body, and rejects unknown fields', () => {
    for (const op of writeBodies) {
      const schema = jsonSchema(op.id)
      expect(JSON.stringify(schema), op.id).not.toMatch(/"(oneOf|anyOf)"/)
      expect(schema.type, op.id).toBe('object')
      expect(schema.additionalProperties, op.id).toBe(false)
    }
  })

  it('limits names to 1-80 characters on every resource', () => {
    for (const op of writeBodies) {
      expect(prop(op.id, 'name'), op.id).toMatchObject({
        minLength: 1,
        maxLength: 80,
      })
    }
  })

  it('constrains codes to the lowercase pattern', () => {
    for (const id of [
      'createSystemRole',
      'createSystemPermission',
      'createSystemDepartment',
    ]) {
      expect(prop(id, 'code').pattern, id).toBe('^[a-z][a-z0-9:_-]{1,79}$')
    }
  })

  it('limits id lists to 200 unique entries', () => {
    const lists: [string, string][] = [
      ['createSystemAccount', 'roleIds'],
      ['createSystemRole', 'permissionIds'],
      ['createSystemRole', 'menuIds'],
      ['createSystemRole', 'departmentIds'],
    ]
    for (const [id, key] of lists) {
      expect(prop(id, key), `${id}.${key}`).toMatchObject({
        maxItems: 200,
        uniqueItems: true,
      })
    }
  })

  it('requires at least one role for an account and bounds menu order to 0-9999', () => {
    expect(prop('createSystemAccount', 'roleIds').minItems).toBe(1)
    expect(prop('createSystemMenu', 'order')).toMatchObject({
      minimum: 0,
      maximum: 9999,
    })
  })

  it('requires the password to create an account but not to update one', () => {
    expect(jsonSchema('createSystemAccount').required).toContain('password')
    expect(jsonSchema('updateSystemAccount').required).not.toContain('password')
    expect(prop('updateSystemAccount', 'password')).toMatchObject({
      minLength: 8,
      maxLength: 128,
    })
  })

  it('states the rules that JSON Schema cannot express in descriptions', () => {
    expect(String(jsonSchema('createSystemRole').description)).toMatch(
      /`scope` is `custom`.*`departmentIds`.*at least one/
    )
    expect(String(prop('createSystemAccount', 'email').description)).toMatch(
      /lower case/
    )
  })
})

describe('the described rules are really enforced at runtime', () => {
  const role = {
    name: 'Editor',
    code: 'editor',
    enabled: true,
    permissionIds: [],
    menuIds: [],
    scope: 'self',
    departmentIds: [],
  }
  const menu = {
    name: 'Users',
    parentId: '',
    kind: 'page',
    routeId: 'users',
    enabled: true,
    visible: true,
    order: 1,
  }
  const account = {
    name: 'Ada',
    email: 'ada@example.org',
    enabled: true,
    departmentId: 'dept',
    roleIds: ['role'],
  }
  const ok = (id: string, value: unknown) => bodyOf(id).safeParse(value).success

  it('enforces name, code, id-list, order and role-count limits', () => {
    expect(ok('createSystemRole', role)).toBe(true)
    expect(ok('createSystemRole', { ...role, name: 'x'.repeat(81) })).toBe(
      false
    )
    expect(ok('createSystemRole', { ...role, code: 'Bad Code' })).toBe(false)
    expect(ok('createSystemRole', { ...role, permissionIds: ['a', 'a'] })).toBe(
      false
    )
    expect(
      ok('createSystemRole', {
        ...role,
        permissionIds: Array.from({ length: 201 }, (_, i) => `p${i}`),
      })
    ).toBe(false)
    expect(ok('createSystemMenu', menu)).toBe(true)
    expect(ok('createSystemMenu', { ...menu, order: 10000 })).toBe(false)
    expect(ok('updateSystemAccount', account)).toBe(true)
    expect(ok('updateSystemAccount', { ...account, roleIds: [] })).toBe(false)
    expect(ok('updateSystemAccount', { ...account, roleIds: ['r', 'r'] })).toBe(
      false
    )
  })

  it('requires departments for a custom scope only', () => {
    expect(ok('createSystemRole', { ...role, scope: 'custom' })).toBe(false)
    expect(
      ok('createSystemRole', {
        ...role,
        scope: 'custom',
        departmentIds: ['d1'],
      })
    ).toBe(true)
  })

  it('requires an initial password on create only', () => {
    expect(ok('createSystemAccount', account)).toBe(false)
    expect(
      ok('createSystemAccount', { ...account, password: 'longenough' })
    ).toBe(true)
  })
})
