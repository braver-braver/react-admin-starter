import { type Permission } from '@/contract/permissions'
import { type AuthUser } from '@/features/auth/schema'

export type { Permission } from '@/contract/permissions'

export function can(user: AuthUser | null, permission: Permission) {
  return user?.permissions.includes(permission) ?? false
}
