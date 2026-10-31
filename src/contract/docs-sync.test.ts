import { describe, expect, it } from 'vitest'
import { API_PREFIX } from './common.ts'
import { type Operation, operations } from './operations.ts'
import { systemResources } from './permissions.ts'

/**
 * M1-T9: the operation table in docs/auth-and-api.md must list exactly the
 * registry operations. The five system resources share one row per action,
 * written with `{resource}` / `{Resource}` placeholders.
 */
const docs = Object.values(
  import.meta.glob('/docs/auth-and-api.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

const resourceNames: Record<string, string> = {
  accounts: 'Account',
  roles: 'Role',
  permissions: 'Permission',
  menus: 'Menu',
  departments: 'Department',
}

function documentedForm(op: Operation) {
  let path = op.path as string
  let id = op.id
  for (const resource of systemResources) {
    if (path.startsWith(`/system/${resource}`)) {
      path = path.replace(`/system/${resource}`, '/system/{resource}')
      id = id.replace(resourceNames[resource], '{Resource}')
    }
  }
  return `${op.method} ${API_PREFIX}${path} ${id}`
}

describe('docs/auth-and-api.md operation table', () => {
  it('found the document', () => {
    expect(docs.length).toBeGreaterThan(1000)
  })

  it('lists exactly the registry operations', () => {
    const rows = [
      ...docs.matchAll(
        /^\| (GET|POST|PUT|PATCH|DELETE) \| (\/api\/\S+) \| (\S+) \|/gm
      ),
    ].map(([, method, path, id]) => `${method} ${path} ${id}`)
    const expected = [
      ...new Set((operations as readonly Operation[]).map(documentedForm)),
    ]
    expect([...rows].sort()).toEqual([...expected].sort())
  })
})
