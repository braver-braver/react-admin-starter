import { describe, expect, it } from 'vitest'

/**
 * B3 (#103): docs/openapi-codegen.md states facts about the generated OpenAPI
 * document that code generators depend on. Keep them true: if the contract
 * changes one of them, the guide must change with it.
 */
const raw = import.meta.glob(
  ['/docs/openapi-codegen.md', '/docs/api.openapi.json'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>
const guide = raw['/docs/openapi-codegen.md']
const spec = JSON.parse(raw['/docs/api.openapi.json']) as {
  openapi: string
  servers: { url: string }[]
  paths: Record<string, Record<string, { description?: string }>>
  components: {
    schemas: Record<string, unknown>
    parameters: Record<
      string,
      { name: string; in: string; schema: { enum?: string[] } }
    >
    securitySchemes: Record<string, { type: string; in: string }>
  }
}

const files = new Set(Object.keys(import.meta.glob(['/docs/**/*', '/*.md'])))

describe('docs/openapi-codegen.md', () => {
  it('matches the OpenAPI version and the relative server URL', () => {
    expect(guide).toContain(`openapi: ${spec.openapi}`)
    expect(spec.servers).toEqual([{ url: '/api/v1' }])
    expect(guide).toContain('`servers` 是相对地址 `/api/v1`')
  })

  it('names the cookie security scheme and the two write headers', () => {
    expect(spec.components.securitySchemes.sessionCookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
    })
    const { RequestedWith, CsrfToken } = spec.components.parameters
    expect(RequestedWith).toMatchObject({
      name: 'X-Requested-With',
      in: 'header',
    })
    expect(RequestedWith.schema.enum).toEqual(['ReactAdminStarter'])
    expect(CsrfToken).toMatchObject({ name: 'X-CSRF-Token', in: 'header' })
    for (const text of [
      'sessionCookie',
      '`X-Requested-With: ReactAdminStarter`',
      '`X-CSRF-Token`',
    ])
      expect(guide).toContain(text)
  })

  it('explains the ErrorCode catalog, which no operation references', () => {
    expect(spec.components.schemas.ErrorCode).toBeDefined()
    const operations = JSON.stringify(spec.paths)
    expect(operations).not.toContain('#/components/schemas/ErrorCode')
    expect(guide).toContain('Unused model: ErrorCode')
  })

  it('points at capability notes that the operations really carry', () => {
    const descriptions = Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods).map((op) => op.description ?? '')
    )
    expect(descriptions).toContain('Requires `audit:read`.')
    expect(guide).toContain('“Requires `audit:read`”')
  })

  it('links only to documents that exist', () => {
    const links = [...guide.matchAll(/\]\(([^)#\s:]+\.md)(?:#[^)]*)?\)/g)].map(
      ([, href]) => new URL(href, 'file:///docs/').pathname
    )
    expect(links.length).toBeGreaterThan(1)
    expect(links.filter((path) => !files.has(path))).toEqual([])
  })
})
