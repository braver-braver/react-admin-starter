import { describe, expect, it } from 'vitest'
import { API_PREFIX } from './common.ts'
import { errorCatalog } from './errors.ts'
import { buildOpenApi } from './openapi.ts'
import { type Operation, operations } from './operations.ts'

// The generated document is plain JSON walked dynamically in these checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

const doc = buildOpenApi({ version: '9.9.9-test' }) as Json
const schemas = doc.components.schemas as Record<string, Json>
const registry: readonly Operation[] = operations

function operationOf(op: Operation): Json {
  return doc.paths[op.path][op.method.toLowerCase()]
}

function resolve(node: Json): Json {
  const target = node.$ref as string | undefined
  return target ? schemas[target.replace('#/components/schemas/', '')] : node
}

describe('generated OpenAPI document', () => {
  it('is OpenAPI 3.1 with the given version and the versioned server prefix', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.version).toBe('9.9.9-test')
    expect(doc.servers).toEqual([{ url: API_PREFIX }])
  })

  it('contains exactly the registry operations, by method, path and id', () => {
    const generated = Object.entries(doc.paths as Record<string, Json>).flatMap(
      ([path, methods]) =>
        Object.entries(methods).map(
          ([method, op]) => `${method.toUpperCase()} ${path} ${op.operationId}`
        )
    )
    expect(generated.sort()).toEqual(
      registry.map((op) => `${op.method} ${op.path} ${op.id}`).sort()
    )
  })

  it('declares the headers and session of every operation', () => {
    for (const op of registry) {
      const refs = (operationOf(op).parameters ?? []).map(
        (p: Json) => p.$ref as string | undefined
      )
      expect(
        refs.includes('#/components/parameters/RequestedWith'),
        op.id
      ).toBe(op.method !== 'GET')
      expect(refs.includes('#/components/parameters/CsrfToken'), op.id).toBe(
        op.csrf
      )
      expect(operationOf(op).security, op.id).toEqual(
        op.auth === 'none' ? [] : [{ sessionCookie: [] }]
      )
    }
  })

  it('lists, per status, exactly the error codes the registry declares', () => {
    for (const op of registry) {
      for (const [status, codes] of Object.entries(op.errors)) {
        const body =
          operationOf(op).responses[status].content['application/json'].schema
        expect(
          body.properties.error.properties.code.enum,
          `${op.id} ${status}`
        ).toEqual(codes)
      }
    }
    expect(schemas.ErrorCode.enum).toEqual(Object.keys(errorCatalog))
  })

  it('wraps every success body in { data } and names every body as a component', () => {
    for (const op of registry) {
      const success =
        operationOf(op).responses[op.success.status].content['application/json']
          .schema
      expect(success.required, op.id).toEqual(['data'])
      expect(resolve(success.properties.data), op.id).toBeDefined()
      const body =
        operationOf(op).requestBody?.content['application/json']?.schema
      if (op.body) expect(resolve(body), op.id).toBeDefined()
    }
  })

  it('keeps request bodies strict and responses open to new fields', () => {
    for (const name of [
      'SystemAccountCreate',
      'SystemAccountUpdate',
      'SystemRoleWrite',
      'SystemPermissionWrite',
      'SystemMenuWrite',
      'SystemDepartmentWrite',
    ]) {
      expect(schemas[name].additionalProperties, name).toBe(false)
    }
    for (const name of [
      'SystemAccount',
      'SystemRole',
      'SystemPermission',
      'SystemMenu',
      'SystemDepartment',
      'User',
      'AuditLog',
      'Session',
      'PageMeta',
    ]) {
      expect(schemas[name].additionalProperties, name).toBeUndefined()
    }
  })

  it('emits timestamps in their wire format', () => {
    for (const field of ['createdAt', 'updatedAt']) {
      expect(schemas.User.properties[field]).toEqual({
        type: 'string',
        format: 'date-time',
      })
    }
    expect(schemas.AuditLog.properties.createdAt).toEqual({
      type: 'string',
      format: 'date-time',
    })
  })

  it('uses one list envelope { items, meta: PageMeta } for every paged list', () => {
    const lists = Object.keys(schemas).filter(
      (name) => name.endsWith('List') && name !== 'IdList'
    )
    expect(lists.sort()).toEqual(
      [
        'AuditList',
        'SystemAccountList',
        'SystemDepartmentList',
        'SystemMenuList',
        'SystemPermissionList',
        'SystemRoleList',
        'UserList',
      ].sort()
    )
    for (const name of lists) {
      expect(schemas[name].required, name).toEqual(['items', 'meta'])
      expect(schemas[name].properties.meta, name).toEqual({
        $ref: '#/components/schemas/PageMeta',
      })
      expect(schemas[name].properties.items.type, name).toBe('array')
    }
    expect(schemas.PageMeta.properties.pageSize.maximum).toBe(100)
  })

  it('describes clamped and fallback query values without rejecting them', () => {
    const listUsers = registry.find((op) => op.id === 'listUsers')!
    const params = operationOf(listUsers).parameters as Json[]
    const pageSize = params.find((p) => p.name === 'pageSize')!
    expect(pageSize.schema.maximum).toBeUndefined()
    expect(pageSize.description).toMatch(/clamped to 100/)
    const sortBy = params.find((p) => p.name === 'sortBy')!
    expect(sortBy.schema.enum).toBeUndefined()
    expect(sortBy.description).toMatch(/falls back to username/)
    const status = params.find((p) => p.name === 'status')!
    expect(status).toMatchObject({ style: 'form', explode: true })
  })

  it('asks clients to send names already trimmed (decision D7)', () => {
    for (const name of ['SystemRoleWrite', 'SystemAccountCreate']) {
      expect(schemas[name].properties.name.maxLength, name).toBe(80)
      expect(schemas[name].properties.name.description, name).toMatch(
        /already trimmed/
      )
    }
  })

  it('keeps the email format of the login body, which Zod checks in a pipe', () => {
    expect(schemas.LoginRequest.properties.email).toMatchObject({
      type: 'string',
      format: 'email',
      minLength: 1,
    })
  })

  it('carries no Zod artefacts: $schema, $id or safe-integer bounds', () => {
    const text = JSON.stringify(doc)
    expect(text).not.toContain('"$schema"')
    expect(text).not.toContain('"$id"')
    expect(text).not.toContain(String(Number.MAX_SAFE_INTEGER))
  })
})
