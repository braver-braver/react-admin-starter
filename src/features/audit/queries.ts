import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { fetchAuditLogs } from './api'
import { type AuditListParams } from './data/schema'

export const auditQueryKey = ['audit-logs'] as const

export function auditQueryOptions(params: AuditListParams) {
  return queryOptions({
    queryKey: [...auditQueryKey, params],
    queryFn: () => fetchAuditLogs(params),
    placeholderData: keepPreviousData,
  })
}
