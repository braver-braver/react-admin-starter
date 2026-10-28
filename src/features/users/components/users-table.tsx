import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useAuthStore } from '@/stores/auth-store'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { Permission } from '@/components/permission'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { usersQueryOptions } from '../queries'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { usersColumns as columns } from './users-columns'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

/**
 * 服务端驱动的用户列表：分页、筛选、排序全部由 URL 状态触发、
 * /api/users 计算；TanStack Table 只负责渲染当前页。
 */
export function getUserRowId(user: User) {
  return user.id
}

export function UsersTable({ search, navigate }: DataTableProps) {
  const user = useAuthStore((state) => state.auth.user)
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const {
    columnFilters,
    onColumnFiltersChange,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    sorting: { defaultSort: [{ id: 'username', desc: false }] },
    columnFilters: [
      // username per-column text filter
      { columnId: 'username', searchKey: 'username', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'role', searchKey: 'role', type: 'array' },
    ],
  })

  const statusFilter = columnFilters.find(
    (filter) => filter.id === 'status'
  )?.value
  const roleFilter = columnFilters.find((filter) => filter.id === 'role')?.value
  const usernameFilter = columnFilters.find(
    (filter) => filter.id === 'username'
  )?.value

  const { data, isPending, isPlaceholderData, isError, refetch } = useQuery(
    usersQueryOptions({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      username:
        typeof usernameFilter === 'string' && usernameFilter.trim() !== ''
          ? usernameFilter.trim()
          : undefined,
      status: Array.isArray(statusFilter)
        ? statusFilter.map(String)
        : undefined,
      role: Array.isArray(roleFilter) ? roleFilter.map(String) : undefined,
      sortBy: sorting?.[0]?.id,
      sortOrder: sorting?.[0]?.desc ? 'desc' : 'asc',
    })
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getRowId: getUserRowId,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility: can(user, 'users:write')
        ? columnVisibility
        : { ...columnVisibility, select: false, actions: false },
    },
    enableRowSelection: can(user, 'users:write'),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: data?.meta.totalPageCount ?? -1,
    onPaginationChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  useEffect(() => {
    if (data?.meta.totalPageCount) {
      ensurePageInRange(data.meta.totalPageCount)
    }
  }, [data?.meta.totalPageCount, ensurePageInRange])

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16', // Add margin bottom to the table on mobile when the toolbar is visible
        'flex flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder='筛选用户…'
        searchKey='username'
        filters={[
          {
            columnId: 'status',
            title: '状态',
            options: [
              { label: '启用', value: 'active' },
              { label: '停用', value: 'inactive' },
              { label: '已邀请', value: 'invited' },
              { label: '已冻结', value: 'suspended' },
            ],
          },
          {
            columnId: 'role',
            title: '角色',
            options: roles.map((role) => ({ ...role })),
          },
        ]}
      />
      {isError && (
        <div
          role='alert'
          className='flex items-center justify-between gap-3 rounded-md border border-destructive/50 p-3 text-sm'
        >
          <span>用户列表加载失败，请检查网络或服务状态。</span>
          <Button variant='outline' size='sm' onClick={() => void refetch()}>
            重试
          </Button>
        </div>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-md border',
          isPlaceholderData && 'opacity-60 transition-opacity'
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  {isPending ? '加载中…' : isError ? '加载失败' : '暂无数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <Permission permission='users:write'>
        <DataTableBulkActions table={table} />
      </Permission>
    </div>
  )
}
