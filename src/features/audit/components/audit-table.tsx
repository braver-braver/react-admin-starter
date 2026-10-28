import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableFacetedFilter,
  DataTablePagination,
} from '@/components/data-table'
import { auditActionLabels, type AuditAction } from '../data/schema'
import { auditQueryOptions } from '../queries'
import { auditColumns as columns } from './audit-columns'

type AuditTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

/**
 * 服务端分页的审计日志表格（只读）：分页与动作筛选全部由 URL 触发、
 * /api/audit-logs 计算；TanStack Table 只渲染当前页。
 */
export function AuditTable({ search, navigate }: AuditTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: 'action', searchKey: 'action', type: 'array' }],
  })

  const actionFilter = columnFilters.find(
    (filter) => filter.id === 'action'
  )?.value

  const { data } = useQuery(
    auditQueryOptions({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      action: Array.isArray(actionFilter)
        ? (actionFilter.map(String) as AuditAction[])
        : undefined,
    })
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { pagination, columnFilters, columnVisibility },
    manualPagination: true,
    manualFiltering: true,
    pageCount: data?.meta.totalPageCount ?? -1,
    onPaginationChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  useEffect(() => {
    if (data?.meta.totalPageCount) {
      ensurePageInRange(data.meta.totalPageCount)
    }
  }, [data?.meta.totalPageCount, ensurePageInRange])

  const actionColumn = table.getColumn('action')
  const filtered = (actionColumn?.getFilterValue() as string[] | undefined)
    ?.length

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <div className='flex items-center gap-2'>
        {actionColumn && (
          <DataTableFacetedFilter
            column={actionColumn}
            title='操作类型'
            options={Object.entries(auditActionLabels).map(
              ([value, label]) => ({ value, label })
            )}
          />
        )}
        {filtered ? (
          <button
            type='button'
            className='text-sm text-muted-foreground hover:text-foreground'
            onClick={() => table.resetColumnFilters()}
          >
            重置筛选
          </button>
        ) : null}
      </div>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className='bg-background'
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className='group/row'>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className='bg-background'>
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
                  暂无审计记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
