import { apiRequest } from '@/lib/api'
import { auditListResponseSchema, type AuditListParams } from './data/schema'

/** 审计日志查询：仅 audit:read（管理员）可访问，由服务端校验。 */
export function fetchAuditLogs(params: AuditListParams) {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('pageSize', String(params.pageSize))
  for (const action of params.action ?? []) search.append('action', action)
  return apiRequest(`/api/audit-logs?${search}`, auditListResponseSchema)
}
