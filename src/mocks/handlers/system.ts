import { ZodError } from 'zod'
import { HttpResponse, http } from 'msw'
import { resourceSchema } from '@/features/system/schema'
import { appendAuditLog } from '../data/audit'
import {
  canAccessData,
  changeSystem,
  systemStore,
  SystemError,
  visibleNavigation,
} from '../data/system'
import { usersStore } from '../data/users'
import {
  apiError,
  currentSession,
  mockBase,
  requireCsrf,
  requirePermission,
} from './auth'

export const systemHandlers = [
  http.get(`${mockBase}api/auth/navigation`, ({ cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    return HttpResponse.json({ data: visibleNavigation(session.user) })
  }),
  http.get(`${mockBase}api/system/options`, ({ cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    if (!session.user.permissions.some((code) => code.startsWith('system:')))
      return apiError(403, 'FORBIDDEN', '没有查看系统配置的权限。')
    const items = systemStore().records.filter(
      (record) =>
        record.resource !== 'accounts' &&
        (record.resource !== 'departments' ||
          record.id === session.user.departmentId ||
          session.user.permissions.some(
            (permission) =>
              permission.startsWith('system:') &&
              canAccessData(
                session.user,
                { departmentId: record.id },
                permission
              )
          ))
    )
    return HttpResponse.json({ data: { items } })
  }),
  http.all(`${mockBase}api/system/:resource`, handle),
  http.all(`${mockBase}api/system/:resource/:id`, handle),
]
async function handle({
  request,
  params,
  cookies,
}: Parameters<Parameters<typeof http.all>[1]>[0]) {
  const resource = resourceSchema.safeParse(params.resource)
  if (!resource.success) return apiError(404, 'NOT_FOUND', '未知系统资源。')
  const session = currentSession(cookies)
  if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
  const read = request.method === 'GET'
  const denied =
    requirePermission(
      session,
      `system:${resource.data}:${read ? 'read' : 'write'}`
    ) ?? (read ? null : requireCsrf(request, session))
  if (denied) return denied
  if (read) {
    if (params.id) return apiError(404, 'NOT_FOUND', '请使用列表接口。')
    const url = new URL(request.url)
    const page = Math.max(
      1,
      Math.trunc(Number(url.searchParams.get('page')) || 1)
    )
    const pageSize = Math.min(
      100,
      Math.max(1, Math.trunc(Number(url.searchParams.get('pageSize')) || 10))
    )
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const items = systemStore().records.filter(
      (record) =>
        record.resource === resource.data &&
        (record.resource !== 'accounts' ||
          canAccessData(session.user, record, 'system:accounts:read')) &&
        (record.resource !== 'departments' ||
          canAccessData(
            session.user,
            { departmentId: record.id },
            'system:departments:read'
          )) &&
        `${record.name} ${'code' in record ? record.code : 'email' in record ? record.email : ''}`
          .toLowerCase()
          .includes(search)
    )
    return HttpResponse.json({
      data: {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize,
      },
    })
  }
  const id = typeof params.id === 'string' ? params.id : undefined
  if (
    (request.method === 'POST' && id) ||
    (request.method !== 'POST' && !id) ||
    !['POST', 'PUT', 'DELETE'].includes(request.method)
  )
    return apiError(400, 'INVALID_METHOD', '操作与资源路径不匹配。')
  try {
    if (
      resource.data === 'departments' &&
      request.method === 'DELETE' &&
      usersStore.some((user) => user.departmentId === id)
    )
      throw new SystemError(409, '该部门仍有关联业务用户，不能删除。')
    const body: unknown =
      request.method === 'DELETE'
        ? null
        : await request.json().catch(() => null)
    const result = await changeSystem(
      resource.data,
      id,
      body,
      session.user,
      request.method === 'DELETE',
      session.credentialVersion ?? 0
    )
    appendAuditLog({
      actorName: session.user.name,
      actorEmail: session.user.email,
      action: 'system.changed',
      target: `${resource.data}/${id ?? ('id' in result ? result.id : '')}`,
      detail: `${request.method} ${resource.data}`,
      ip: '127.0.0.1',
    })
    return HttpResponse.json(
      { data: result },
      { status: request.method === 'POST' ? 201 : 200 }
    )
  } catch (error) {
    if (error instanceof ZodError)
      return apiError(
        422,
        'INVALID_FIELDS',
        error.issues[0]?.message ?? '请检查输入。'
      )
    if (error instanceof SystemError)
      return apiError(error.status, 'SYSTEM_RULE', error.message)
    throw error
  }
}
