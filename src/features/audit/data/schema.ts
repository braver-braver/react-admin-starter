import { z } from 'zod'

/** 审计动作白名单：与服务端契约、mock 流水共用同一份定义 */
export const auditActionValues = [
  'auth.sign_in',
  'auth.sign_out',
  'user.created',
  'user.updated',
  'user.deleted',
  'user.batch_deleted',
  'user.status_changed',
  'user.invited',
  'user.batch_invited',
] as const

export const auditActionSchema = z.enum(auditActionValues)
export type AuditAction = z.infer<typeof auditActionSchema>

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
}

export const auditLogSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  actorName: z.string(),
  actorEmail: z.string(),
  action: auditActionSchema,
  target: z.string(),
  detail: z.string(),
  ip: z.string(),
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const auditListResponseSchema = z.object({
  items: z.array(auditLogSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPageCount: z.number(),
  }),
})
export type AuditListResponse = z.infer<typeof auditListResponseSchema>

export type AuditListParams = {
  page: number
  pageSize: number
  action?: AuditAction[]
}
