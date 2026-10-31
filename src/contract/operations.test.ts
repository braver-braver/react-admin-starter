import { describe, expect, it } from 'vitest'
import { errorCatalog, type ErrorCode, type ErrorCodeFor } from './errors.ts'
import { operations, type Operation, type OperationId } from './operations.ts'
import { systemResources } from './permissions.ts'

/** Widened view for iteration; `operations` itself keeps literal types. */
const registry: readonly Operation[] = operations

const contractSources = import.meta.glob(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
// The conformance suite follows the same rules: a Node runner loads it too.
const conformanceSources = import.meta.glob(
  ['./conformance/*.ts', '!./conformance/*.test.ts'],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>
const mockSources = import.meta.glob('../mocks/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('operation registry', () => {
  it('registers all 36 registry: 16 fixed paths plus 5 resources x 4', () => {
    const system = registry.filter((op) => op.path.startsWith('/system/'))
    const fixed = registry.filter(
      (op) =>
        !/^\/system\/(accounts|roles|permissions|menus|departments)/.test(
          op.path
        )
    )
    expect(registry).toHaveLength(36)
    expect(fixed).toHaveLength(16)
    expect(system.filter((op) => op.path !== '/system/options')).toHaveLength(
      20
    )
    for (const resource of systemResources) {
      const ofResource = registry.filter((op) =>
        op.path.startsWith(`/system/${resource}`)
      )
      expect(ofResource.map((op) => op.method).sort()).toEqual([
        'DELETE',
        'GET',
        'POST',
        'PUT',
      ])
    }
  })

  it('has unique operation ids and unique method + path pairs', () => {
    const ids = registry.map((op) => op.id)
    const routes = registry.map((op) => `${op.method} ${op.path}`)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('requires a session for every operation except login', () => {
    expect(
      registry.filter((op) => op.auth === 'none').map((op) => op.id)
    ).toEqual(['login'])
    for (const op of registry.filter((op) => op.auth === 'session')) {
      expect(op.errors[401], op.id).toContain('UNAUTHENTICATED')
    }
  })

  it('declares CSRF only on writes, and the CSRF error wherever it is required', () => {
    for (const op of registry) {
      if (op.method === 'GET') expect(op.csrf, op.id).toBe(false)
      if (op.csrf) expect(op.errors[403], op.id).toContain('INVALID_CSRF_TOKEN')
      if (op.permission) expect(op.errors[403], op.id).toContain('FORBIDDEN')
    }
  })

  it('declares the missing-header error on every write (POST, PUT, PATCH, DELETE)', () => {
    const writes = registry.filter((op) => op.method !== 'GET')
    expect(writes.length).toBeGreaterThan(0)
    for (const op of writes) {
      expect(op.errors[403], op.id).toContain('REQUEST_HEADER_REQUIRED')
    }
  })

  it('declares only codes that the catalog allows for that status', () => {
    for (const op of registry) {
      for (const [status, codes] of Object.entries(op.errors)) {
        for (const code of codes as readonly ErrorCode[]) {
          expect(
            errorCatalog[code].status as readonly number[],
            `${op.id} ${status} ${code}`
          ).toContain(Number(status))
        }
      }
    }
  })

  it('uses every operation-scoped error code at least once', () => {
    const used = new Set(
      registry.flatMap((op) => Object.values(op.errors).flat() as ErrorCode[])
    )
    const unused = (Object.keys(errorCatalog) as ErrorCode[]).filter(
      (code) => errorCatalog[code].scope === 'operation' && !used.has(code)
    )
    expect(unused).toEqual([])
  })
})

describe('literal types', () => {
  it('keeps operation ids as literals, so clients can be typed from them', () => {
    const known: OperationId = 'listUsers'
    const generated: OperationId = 'createSystemRole'
    // @ts-expect-error not a registered operation id
    const unknown: OperationId = 'dropDatabase'
    expect([known, generated, unknown]).toHaveLength(3)
  })

  it('uses a different request schema for creating and updating an account', () => {
    const create = registry.find((op) => op.id === 'createSystemAccount')
    const update = registry.find((op) => op.id === 'updateSystemAccount')
    const base = {
      name: 'Ada',
      email: 'ada@example.org',
      enabled: true,
      departmentId: 'dept',
      roleIds: ['role'],
    }
    expect(create?.body?.safeParse(base).success).toBe(false)
    expect(
      create?.body?.safeParse({ ...base, password: 'longenough' }).success
    ).toBe(true)
    expect(update?.body?.safeParse(base).success).toBe(true)
  })

  it('declares {ids} as the body of the id-list batch operations', () => {
    for (const id of ['batchDeleteUsers', 'inviteUsersBatch']) {
      const body = registry.find((op) => op.id === id)?.body
      expect(body?.safeParse({ ids: ['a'] }).success, id).toBe(true)
      expect(body?.safeParse({}).success, id).toBe(false)
    }
  })
})

describe('error code table', () => {
  it('lists 21 codes', () => {
    expect(Object.keys(errorCatalog)).toHaveLength(21)
  })

  it('covers every code the mock handlers can return', () => {
    const found = new Set<string>()
    for (const source of Object.values(mockSources)) {
      for (const match of source.matchAll(
        /apiError\(\s*[^,]+,\s*'([A-Z_]+)'/g
      )) {
        found.add(match[1])
      }
    }
    expect(found.size).toBeGreaterThan(15)
    expect([...found].filter((code) => !(code in errorCatalog))).toEqual([])
  })

  it('rejects unregistered codes, or codes for the wrong status, at compile time', () => {
    const ok: ErrorCodeFor<403> = 'FORBIDDEN'
    // @ts-expect-error UNAUTHENTICATED is a 401 code
    const wrongStatus: ErrorCodeFor<403> = 'UNAUTHENTICATED'
    // @ts-expect-error not in the catalog
    const unknown: ErrorCodeFor<422> = 'NOT_A_REGISTERED_CODE'
    expect([ok, wrongStatus, unknown]).toHaveLength(3)
  })
})

describe('contract directory', () => {
  it('only imports zod or sibling .ts files, so Node can load it directly', () => {
    const files = Object.entries(contractSources)
    expect(files.length).toBeGreaterThanOrEqual(8)
    for (const [file, source] of files) {
      for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        expect(match[1], file).toMatch(/^(zod|\.\/[a-z-]+\.ts)$/)
      }
      expect(source, file).not.toMatch(/import\.meta/)
      expect(source, file).not.toMatch(/from\s+'@\//)
    }
  })

  it('keeps the conformance suite free of aliases, Vite, browser and Node APIs', () => {
    const files = Object.entries(conformanceSources)
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const [file, source] of files) {
      for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        expect(match[1], file).toMatch(/^(zod|\.\.?\/[a-z0-9-]+\.ts)$/)
      }
      expect(source, file).not.toMatch(
        /import\.meta|\b(window|document|localStorage|sessionStorage|process)\./
      )
    }
  })

  it('carries no demo identifiers that the production check forbids', () => {
    for (const [file, source] of Object.entries({
      ...contractSources,
      ...conformanceSources,
    })) {
      expect(source, file).not.toMatch(
        /mock_session|Demo1234|admin@example\.com/i
      )
    }
  })
})
