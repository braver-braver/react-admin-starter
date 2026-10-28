import { type Table } from '@tanstack/react-table'
import { vi } from 'vitest'

/**
 * Minimal TanStack Table mock for tests that only need selected row count and
 * `resetRowSelection` (e.g. multi-delete dialogs).
 */
export function createTableMock(
  rowCount = 2,
  originals: Array<Record<string, unknown>> = Array.from(
    { length: rowCount },
    () => ({})
  )
) {
  const rows = originals.map((original) => ({ original }))
  const resetRowSelection = vi.fn()
  const table = {
    getFilteredSelectedRowModel: () => ({ rows }),
    resetRowSelection,
  } as unknown as Table<Record<string, unknown>>
  return { table, resetRowSelection }
}
