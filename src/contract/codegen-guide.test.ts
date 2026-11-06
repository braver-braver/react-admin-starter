import { describe, expect, it } from 'vitest'

/**
 * B3 (#103): docs/openapi-codegen.md states facts about the generated OpenAPI
 * document that code generators depend on. Keep them true: if the contract
 * changes one of them, the guide must change with it.
 */
const raw = import.meta.glob(
  ['/docs/openapi-codegen.md', '/docs/api.openapi.json', '/docs/releasing.md'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>
const guide = raw['/docs/openapi-codegen.md']
const releasing = raw['/docs/releasing.md']
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

  it('describes responses as inline envelopes around named payloads', () => {
    type Schema = {
      $ref?: string
      properties?: Record<string, Schema>
    }
    const responses = Object.values(spec.paths).flatMap((methods) =>
      Object.values(methods).flatMap((op) =>
        Object.entries(
          (
            op as {
              responses: Record<
                string,
                { content?: Record<string, { schema: Schema }> }
              >
            }
          ).responses
        ).flatMap(([status, response]) => {
          const schema = response.content?.['application/json']?.schema
          return schema ? [{ status: Number(status), schema }] : []
        })
      )
    )
    expect(responses.length).toBeGreaterThan(100)
    expect(responses.filter(({ schema }) => schema.$ref)).toEqual([])
    for (const { status, schema } of responses)
      if (status >= 400)
        expect(schema.properties?.error, String(status)).toBeDefined()
    expect(
      responses.some(
        ({ status, schema }) =>
          status < 300 &&
          schema.properties?.data?.$ref?.startsWith('#/components/schemas/')
      )
    ).toBe(true)
    expect(guide).toContain('响应本身的外层信封都是内联对象')
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

  it('pins exact generator versions and a tag-pinned way to fetch the contract', () => {
    for (const command of [
      'openapi-typescript@7.13.0',
      'oapi-codegen@v2.8.2',
      'openapi-generator-cli-7.27.0.jar',
      'datamodel-code-generator==0.89.0',
    ])
      expect(guide).toContain(command)
    const commands = [...guide.matchAll(/```\w*\n([\s\S]*?)```/g)]
      .map(([, block]) => block)
      .join('\n')
    expect(commands).not.toMatch(/@latest|@\d+\s|@v\d+\s/)
    expect(guide).toContain(
      'https://raw.githubusercontent.com/braver-braver/react-admin-starter/v1.0.0/docs/api.openapi.json'
    )
    // The release steps upload the asset the guide tells readers to download.
    expect(releasing).toMatch(/gh release create .* api\.openapi\.json\n/)
  })

  it('links only to documents that exist', () => {
    const links = [...guide.matchAll(/\]\(([^)#\s:]+\.md)(?:#[^)]*)?\)/g)].map(
      ([, href]) => new URL(href, 'file:///docs/').pathname
    )
    expect(links.length).toBeGreaterThan(1)
    expect(links.filter((path) => !files.has(path))).toEqual([])
  })
})
