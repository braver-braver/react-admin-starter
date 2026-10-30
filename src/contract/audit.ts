import { z } from 'zod'
import { pageMetaSchema } from './common.ts'

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
  meta: pageMetaSchema,
})
export type AuditListResponse = z.infer<typeof auditListResponseSchema>
