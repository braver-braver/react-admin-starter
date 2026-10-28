import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { batchInviteUsers, updateUsersStatus } from '../api'
import { type User } from '../data/schema'
import { usersQueryKey } from '../queries'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const queryClient = useQueryClient()

  const selectedIds = selectedRows.map((row) => (row.original as User).id)
  const selectedCount = selectedRows.length

  const afterSuccess = () => {
    table.resetRowSelection()
    void queryClient.invalidateQueries({ queryKey: usersQueryKey })
  }

  const statusMutation = useMutation({
    mutationFn: (status: 'active' | 'inactive') =>
      updateUsersStatus(selectedIds, status),
    onSuccess: () => {
      toast.success(`已批量更新 ${selectedCount} 个用户的状态。`)
      afterSuccess()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '操作失败，请稍后重试。'
      )
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => batchInviteUsers(selectedIds),
    onSuccess: (count) => {
      toast.success(`已向 ${count} 个用户发送邀请。`)
      afterSuccess()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '操作失败，请稍后重试。'
      )
    },
  })

  const pending = statusMutation.isPending || inviteMutation.isPending

  return (
    <>
      <BulkActionsToolbar table={table} entityName='user'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              disabled={pending}
              onClick={() => inviteMutation.mutate()}
              className='size-8'
              aria-label='向所选用户发送邀请'
              title='向所选用户发送邀请'
            >
              <Mail />
            </Button>
          </TooltipTrigger>
          <TooltipContent>向所选用户发送邀请</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              disabled={pending}
              onClick={() => statusMutation.mutate('active')}
              className='size-8'
              aria-label='启用所选用户'
              title='启用所选用户'
            >
              <UserCheck />
            </Button>
          </TooltipTrigger>
          <TooltipContent>启用所选用户</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              disabled={pending}
              onClick={() => statusMutation.mutate('inactive')}
              className='size-8'
              aria-label='停用所选用户'
              title='停用所选用户'
            >
              <UserX />
            </Button>
          </TooltipTrigger>
          <TooltipContent>停用所选用户</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='删除所选用户'
              title='删除所选用户'
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除所选用户</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
