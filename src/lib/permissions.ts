import { type AuthUser } from '@/features/auth/schema'

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'permissions:read'
  | 'audit:read'
export function can(user: AuthUser | null, permission: Permission) {
  return user?.permissions.includes(permission) ?? false
}
