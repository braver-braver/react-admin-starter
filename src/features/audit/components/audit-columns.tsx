import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { auditActionLabels, type AuditLog } from '../data/schema'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export const auditColumns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: 'createdAt',
    header: '时间',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-nowrap tabular-nums'>
        {dateFormatter.format(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: '操作',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant='outline' className='text-nowrap'>
        {auditActionLabels[row.original.action]}
      </Badge>
    ),
  },
  {
    id: 'actor',
    header: '操作人',
    enableSorting: false,
    cell: ({ row }) => (
      <div className='min-w-36'>
        <div className='truncate'>{row.original.actorName}</div>
        <div className='truncate text-xs text-muted-foreground'>
          {row.original.actorEmail}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'target',
    header: '对象',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='block max-w-56 truncate'>{row.original.target}</span>
    ),
  },
  {
    accessorKey: 'detail',
    header: '详情',
    enableSorting: false,
  },
  {
    accessorKey: 'ip',
    header: 'IP',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>
        {row.original.ip}
      </span>
    ),
  },
]
