import { type AuditAction } from '@/contract/audit'

// Schemas live in the API contract; re-exported so UI imports stay stable.
export * from '@/contract/audit'

export const auditActionLabels: Record<AuditAction, string> = {
  'auth.sign_in': '登录',
  'auth.sign_out': '退出登录',
  'user.created': '创建用户',
  'user.updated': '更新用户',
  'user.deleted': '删除用户',
  'user.batch_deleted': '批量删除',
  'user.status_changed': '变更状态',
  'user.invited': '邀请用户',
  'user.batch_invited': '批量邀请',
  'system.changed': '系统配置变更',
}

export type AuditListParams = {
  page: number
  pageSize: number
  action?: AuditAction[]
}
