import { describe, expect, it } from 'vitest'

/**
 * B1 (#99): docs/adding-a-module.md walks through real files and helpers. Keep
 * it honest: every repository path and relative link it names must exist, and
 * every helper it tells readers to use must still be exported (or, for module
 * constants, still be defined) where it says. The example module
 * (`announcements`) is hypothetical, so its paths are skipped.
 */
const guide = Object.values(
  import.meta.glob('/docs/adding-a-module.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

const files = new Set(
  Object.keys(
    import.meta.glob([
      '/src/**/*',
      '/docs/**/*',
      '/scripts/**/*',
      '/e2e/**/*',
      '/.github/**/*',
      '/*.md',
    ])
  ).concat('/src/contract/module-guide.test.ts') // a glob never lists its own file
)

const sources = import.meta.glob(
  [
    '/src/contract/operations.ts',
    '/src/contract/openapi.ts',
    '/src/contract/errors.ts',
    '/src/features/system/navigation.ts',
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

const exportsOf = import.meta.glob([
  '/src/contract/common.ts',
  '/src/contract/operations.ts',
  '/src/contract/errors.ts',
  '/src/contract/conformance/tier1.ts',
  '/src/features/system/catalog.ts',
  '/src/mocks/handlers/auth.ts',
  '/src/mocks/data/audit.ts',
  '/src/lib/api.ts',
  '/src/lib/permissions.ts',
]) as Record<string, () => Promise<Record<string, unknown>>>

const hypothetical = /announcement/i

describe('docs/adding-a-module.md', () => {
  it('found the guide', () => {
    expect(guide.length).toBeGreaterThan(2000)
  })

  it('names only repository files that exist', () => {
    const named = [
      ...guide.matchAll(
        /`((?:src|docs|scripts|e2e|\.github)\/[\w./-]+\.(?:ts|tsx|md|mjs|json))`/g
      ),
    ].map(([, path]) => path)
    expect(named.length).toBeGreaterThan(20)
    const missing = named.filter(
      (path) => !hypothetical.test(path) && !files.has(`/${path}`)
    )
    expect(missing).toEqual([])
  })

  it('links only to documents that exist', () => {
    const links = [...guide.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)].map(
      ([, href]) => new URL(href, 'file:///docs/').pathname
    )
    expect(links.length).toBeGreaterThan(5)
    expect(links.filter((path) => !files.has(path))).toEqual([])
  })

  it('points at helpers that are still exported where it says', async () => {
    const expected: Record<string, string[]> = {
      '/src/contract/common.ts': [
        'listEnvelope',
        'pageSizeQuery',
        'wireDate',
        'API_PREFIX',
        'successSchema',
      ],
      '/src/contract/operations.ts': ['operations'],
      '/src/contract/errors.ts': ['errorCatalog'],
      '/src/contract/conformance/tier1.ts': ['unique', 'withUsers'],
      '/src/features/system/catalog.ts': ['apiCatalog', 'routeCatalog'],
      '/src/mocks/handlers/auth.ts': [
        'apiBase',
        'apiError',
        'currentSession',
        'requireCsrf',
        'requirePermission',
        'requireRequestedWith',
      ],
      '/src/mocks/data/audit.ts': ['appendAuditLog'],
      '/src/lib/api.ts': ['callOperation'],
      '/src/lib/permissions.ts': ['can'],
    }
    for (const [path, names] of Object.entries(expected)) {
      const module = await exportsOf[path]()
      for (const name of names) {
        expect(module[name], `${path} exports ${name}`).toBeDefined()
        expect(guide, `the guide names ${name}`).toContain(name)
      }
    }
  })

  it('relies on module constants that still exist', () => {
    const operations = sources['/src/contract/operations.ts']
    for (const name of ['guarded', 'guardedWrite', 'scopedWrite', 'idParams'])
      expect(operations).toMatch(new RegExp(`const ${name} = `))
    expect(sources['/src/features/system/navigation.ts']).toMatch(
      /const icons = \{/
    )
    expect(sources['/src/contract/errors.ts']).toMatch(/INVALID_USER_FIELDS:/)
    expect(sources['/src/contract/errors.ts']).toMatch(/USER_NOT_FOUND:/)
    // The OpenAPI generator names every body and success schema, and throws
    // the error the guide quotes when one is missing.
    expect(sources['/src/contract/openapi.ts']).toMatch(/const namedSchemas: /)
    expect(sources['/src/contract/openapi.ts']).toContain(
      'No component name for a schema of operation'
    )
    expect(operations).toMatch(/id: 'listAuditLogs'/)
  })
})
