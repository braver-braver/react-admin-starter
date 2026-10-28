import { useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { signOut, safeRedirect } from '@/features/auth/session'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      await navigate({
        to: '/sign-in',
        search: { redirect: safeRedirect(location.href) },
        replace: true,
      })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退出失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      desc='确认退出当前账户吗？退出后需要重新登录。'
      confirmText='退出登录'
      cancelBtnText='取消'
      isLoading={isLoading}
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
