import { describe, expect, it } from 'vitest'
import { routeCatalog } from '@/features/system/catalog'
import { errorCatalog } from './errors.ts'
import { type Operation, operations } from './operations.ts'

/**
 * M2-T8: the tables in docs/backend-integration.md that restate code must not
 * drift from it. Each table sits between `<!-- name:start -->` and
 * `<!-- name:end -->` markers.
 */
const guide = Object.values(
  import.meta.glob('/docs/backend-integration.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

/** Data rows of a marked table, as arrays of trimmed cells. */
function table(name: string): string[][] {
  const start = guide.indexOf(`<!-- ${name}:start -->`)
  const end = guide.indexOf(`<!-- ${name}:end -->`)
  expect(start, name).toBeGreaterThan(-1)
  expect(end, name).toBeGreaterThan(start)
  return guide
    .slice(start, end)
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    )
}

const code = (cell: string) => cell.replace(/^`|`$/g, '')

describe('docs/backend-integration.md tables', () => {
  it('lists every error code with its statuses, in catalog order', () => {
    expect(
      table('error-codes').map(([name, statuses]) => [code(name), statuses])
    ).toEqual(
      Object.entries(errorCatalog).map(([name, entry]) => [
        name,
        entry.status.join('/'),
      ])
    )
  })

  it('lists exactly the capability codes the operation registry requires', () => {
    const required = (operations as readonly Operation[]).flatMap((op) =>
      op.permission === undefined
        ? []
        : typeof op.permission === 'string'
          ? [op.permission]
          : [...op.permission]
    )
    expect(
      table('capabilities')
        .map(([name]) => code(name))
        .sort()
    ).toEqual([...new Set(required)].sort())
  })

  it('lists every registered page with its path and capability', () => {
    expect(
      table('routes').map(([id, path, permission]) => [
        code(id),
        code(path),
        permission.startsWith('`') ? code(permission) : '',
      ])
    ).toEqual(
      routeCatalog.map((route) => [route.id, route.path, route.permission])
    )
  })
})
