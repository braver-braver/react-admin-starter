import { useAuthStore } from '@/stores/auth-store'
import { can, type Permission as PermissionName } from '@/lib/permissions'

export function Permission({
  permission,
  children,
}: {
  permission: PermissionName
  children: React.ReactNode
}) {
  const user = useAuthStore((state) => state.auth.user)
  return can(user, permission) ? children : null
}
