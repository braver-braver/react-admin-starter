import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { AuditLogs } from '@/features/audit'
import { auditActionValues } from '@/features/audit/data/schema'

const auditSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  action: z.array(z.enum(auditActionValues)).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/audit/')({
  beforeLoad: ({ context }) => {
    if (!can(context.session.user, 'audit:read')) throw redirect({ to: '/403' })
  },
  validateSearch: auditSearchSchema,
  component: AuditLogs,
})
