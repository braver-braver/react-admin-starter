import { describe, expect, it } from 'vitest'
import { API_PREFIX } from './common.ts'
import { type Operation, operations } from './operations.ts'
import { systemResources } from './permissions.ts'

/**
 * M1-T9: the operation table in docs/auth-and-api.md must list exactly the
 * registry operations. The five system resources share one row per action,
 * written with `{resource}` / `{Resource}` placeholders; the test expands
 * those rows to every resource, so each concrete operation is compared.
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

/** A documented row, with `{resource}` rows expanded to each resource. */
function expand(method: string, path: string, id: string): string[] {
  if (!path.includes('{resource}')) return [`${method} ${path} ${id}`]
  return systemResources.map(
    (resource) =>
      `${method} ${path.replace('{resource}', resource)} ${id.replace('{Resource}', resourceNames[resource])}`
  )
}

describe('docs/auth-and-api.md operation table', () => {
  it('found the document', () => {
    expect(docs.length).toBeGreaterThan(1000)
  })

  it('lists exactly the registry operations, one per resource', () => {
    const documented = [
      ...docs.matchAll(
        /^\| (GET|POST|PUT|PATCH|DELETE) \| (\/api\/\S+) \| (\S+) \|/gm
      ),
    ].flatMap(([, method, path, id]) => expand(method, path, id))
    const registered = (operations as readonly Operation[]).map(
      (op) => `${op.method} ${API_PREFIX}${op.path} ${op.id}`
    )
    expect(documented.sort()).toEqual(registered.sort())
  })
})
