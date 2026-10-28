import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { batchDeleteUsers } from '../api'
import { type User } from '../data/schema'
import { usersQueryKey } from '../queries'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = '删除'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')
  const queryClient = useQueryClient()

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const mutation = useMutation({
    mutationFn: () =>
      batchDeleteUsers(selectedRows.map((row) => (row.original as User).id)),
    onSuccess: (deletedCount) => {
      toast.success(`已删除 ${deletedCount} 个用户。`)
      setValue('')
      table.resetRowSelection()
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '删除失败，请稍后重试。'
      )
    },
  })

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`请输入「${CONFIRM_WORD}」以确认。`)
      return
    }
    mutation.mutate()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD || mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除 {selectedRows.length} 个用户
        </span>
      }
      desc={
        <form
          id='users-multi-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            确认删除所选的 {selectedRows.length} 个用户吗？
            <br />
            此操作无法撤销。
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span>输入「{CONFIRM_WORD}」以确认：</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`输入「${CONFIRM_WORD}」确认`}
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>警告</AlertTitle>
            <AlertDescription>此操作不可撤销，请谨慎确认。</AlertDescription>
          </Alert>
        </form>
      }
      confirmText='删除'
      destructive
    />
  )
}
