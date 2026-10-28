import { type AuthUser } from '@/features/auth/schema'

/** UX helper; APIs must resolve fresh scopes from their own trusted role store. */
export function canAccessData(
  user: AuthUser | null,
  record: { departmentId?: string; createdBy?: string; id?: string },
  permission = 'users:read'
) {
  const scope = user?.dataScopes?.[permission]
  return !!(
    user &&
    scope &&
    (scope.all ||
      (record.departmentId &&
        scope.departments.includes(record.departmentId)) ||
      (scope.self && (record.createdBy === user.id || record.id === user.id)))
  )
}
