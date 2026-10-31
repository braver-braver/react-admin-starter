import { type AuditListParams } from '@/contract/audit'
import { callOperation } from '@/lib/api'

/** 审计日志查询：仅 audit:read（管理员）可访问，由服务端校验。 */
export const fetchAuditLogs = (query: AuditListParams) =>
  callOperation('listAuditLogs', { query })
