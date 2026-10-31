import { z } from 'zod'
import { listEnvelope, pageSizeQuery, wireDate } from './common.ts'

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
  'system.changed',
] as const

export const auditActionSchema = z.enum(auditActionValues)
export type AuditAction = z.infer<typeof auditActionSchema>

export const auditLogSchema = z.object({
  id: z.string(),
  createdAt: wireDate,
  actorName: z.string(),
  actorEmail: z.string(),
  action: auditActionSchema,
  target: z.string(),
  detail: z.string(),
  ip: z.string(),
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const auditListResponseSchema = listEnvelope(auditLogSchema)
export type AuditListResponse = z.infer<typeof auditListResponseSchema>

/** GET /api/audit-logs query string. `pageSize` above 100 is clamped to 100. */
export const auditQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: pageSizeQuery,
  action: z.array(auditActionSchema).optional(),
})
/** Client-side parameters: page and pageSize are always sent. */
export type AuditListParams = z.input<typeof auditQuerySchema> & {
  page: number
  pageSize: number
}
