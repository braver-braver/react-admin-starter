import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { deleteUser } from '../api'
import { type User } from '../data/schema'
import { usersQueryKey } from '../queries'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const [value, setValue] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => deleteUser(currentRow.id),
    onSuccess: () => {
      toast.success(`用户 ${currentRow.username} 已删除。`)
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '删除失败，请稍后重试。'
      )
    },
  })

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return
    mutation.mutate()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-delete-form'
      disabled={value.trim() !== currentRow.username || mutation.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除用户
        </span>
      }
      desc={
        <form
          id='users-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            确认删除用户{' '}
            <span className='font-bold'>{currentRow.username}</span>
            ？<br />
            该用户的角色为 <span className='font-bold'>{currentRow.role}</span>
            ，删除后无法恢复。
          </p>

          <Label className='my-2'>
            用户名：
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='输入用户名以确认删除'
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
