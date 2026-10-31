import {
  type TableState,
  createTable,
  getCoreRowModel,
} from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { type User } from '../data/schema'
import { getUserRowId } from './user-row-id'

const first: User = {
  id: 'usr-a',
  firstName: '安',
  lastName: '李',
  username: 'li_an',
  email: 'li.an@example.com',
  phoneNumber: '13800000000',
  role: 'admin',
  status: 'active',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}

const second: User = {
  ...first,
  id: 'usr-b',
  username: 'li_b',
  email: 'li.b@example.com',
}

function makePage(user: User) {
  return createTable<User>({
    data: [user],
    columns: [],
    state: {
      rowSelection: { [first.id]: true },
    } as TableState,
    onStateChange: () => undefined,
    renderFallbackValue: null,
    getRowId: getUserRowId,
    getCoreRowModel: getCoreRowModel(),
  })
}

describe('server-paginated user row selection', () => {
  it('identifies a row by user ID, not its current page index', () => {
    const firstPage = makePage(first)
    expect(firstPage.getRowModel().rows[0].id).toBe(first.id)
    expect(firstPage.getSelectedRowModel().rows).toHaveLength(1)

    const secondPage = makePage(second)
    expect(secondPage.getRowModel().rows[0].id).toBe(second.id)
    expect(secondPage.getSelectedRowModel().rows).toHaveLength(0)
  })
})
