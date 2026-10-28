import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { type Permission, type Role, type SessionUser } from './schemas'

/**
 * RBAC 辅助函数。
 *
 * 服务端授权是唯一的安全边界；这里的判断仅用于界面展示
 * （隐藏按钮、路由重定向等 UX 守卫），不能作为权限校验本身。
 */

export function hasPermissions(
  user: SessionUser | null | undefined,
  required: Permission[]
): boolean {
  if (!user) return false
  return required.every((permission) => user.permissions.includes(permission))
}

export function hasAnyPermission(
  user: SessionUser | null | undefined,
  required: Permission[]
): boolean {
  if (!user) return false
  return required.some((permission) => user.permissions.includes(permission))
}

export function hasRole(
  user: SessionUser | null | undefined,
  roles: Role[]
): boolean {
  if (!user) return false
  return user.roles.some((role) => roles.includes(role))
}

/** 读取当前会话并判断是否拥有全部指定权限。 */
export function usePermissions(required: Permission[]): boolean {
  const user = useAuthStore((state) => state.auth.user)
  return useMemo(() => hasPermissions(user, required), [user, required])
}

/** 角色的中文展示名，仅用于界面文案。 */
export const roleLabels: Record<Role, string> = {
  admin: '管理员',
  operator: '运营人员',
  viewer: '只读访客',
}
