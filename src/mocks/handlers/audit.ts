import { HttpResponse, http } from 'msw'
import { auditLogsStore } from '../data/audit'
import { canAccessData } from '../data/system'
import { apiError, currentSession, mockBase, requirePermission } from './auth'

function parseListQuery(request: Request) {
  const { searchParams } = new URL(request.url)
  const positive = (key: string, fallback: number) => {
    const raw = Number(searchParams.get(key))
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
  }
  return {
    page: positive('page', 1),
    // Same cap as the other lists (decision D3).
    pageSize: Math.min(100, positive('pageSize', 10)),
    action: searchParams.getAll('action').filter((value) => value !== ''),
  }
}

export const auditHandlers = [
  http.get(`${mockBase}api/audit-logs`, ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied = requirePermission(session, 'audit:read')
    if (denied) return denied

    const query = parseListQuery(request)
    const scopedLogs = auditLogsStore.filter((log) =>
      canAccessData(session.user, log, 'audit:read')
    )
    const filtered = query.action.length
      ? scopedLogs.filter((log) => query.action.includes(log.action))
      : scopedLogs
    const total = filtered.length
    const totalPageCount = Math.max(1, Math.ceil(total / query.pageSize))
    const page = Math.min(Math.max(1, query.page), totalPageCount)
    const start = (page - 1) * query.pageSize

    return HttpResponse.json({
      data: {
        items: filtered.slice(start, start + query.pageSize),
        meta: { page, pageSize: query.pageSize, total, totalPageCount },
      },
    })
  }),
]
