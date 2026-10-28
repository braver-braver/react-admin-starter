import { HttpResponse, http } from 'msw'
import { type AuthUser } from '@/features/auth/schema'
import { appendAuditLog } from '../data/audit'
import { canAccessData, systemStore } from '../data/system'
import {
  createUserId,
  findUserByEmailOrUsername,
  usersStore,
  type MockUser,
} from '../data/users'
import {
  apiError,
  currentSession,
  mockBase,
  requireCsrf,
  requirePermission,
} from './auth'

/**
 * 用户管理 mock handlers：服务端分页、筛选、排序与增删改。
 * 读操作要求 users:read，写操作要求 users:write + CSRF，
 * 并同步写入审计流水——这是「服务端授权强制」的参考实现，
 * 客户端的路由与按钮守卫只是 UX。
 */

type UsersQuery = {
  page: number
  pageSize: number
  username: string
  status: string[]
  role: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const SORTABLE_KEYS = new Set([
  'username',
  'fullName',
  'email',
  'phoneNumber',
  'status',
  'role',
  'createdAt',
  'updatedAt',
])

function parseUsersQuery(request: Request): UsersQuery {
  const { searchParams } = new URL(request.url)
  const multi = (key: string): string[] =>
    [...searchParams.getAll(key), ...searchParams.getAll(`${key}[]`)].filter(
      (value) => value !== ''
    )
  const positive = (key: string, fallback: number) => {
    const raw = Number(searchParams.get(key))
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
  }
  const sortBy = searchParams.get('sortBy') ?? 'username'

  return {
    page: positive('page', 1),
    pageSize: positive('pageSize', 10),
    username: (searchParams.get('username') ?? '').trim().toLowerCase(),
    status: multi('status'),
    role: multi('role'),
    sortBy: SORTABLE_KEYS.has(sortBy) ? sortBy : 'username',
    sortOrder: searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc',
  }
}

function fullNameOf(user: MockUser): string {
  return `${user.lastName}${user.firstName}`
}

function sortValue(user: MockUser, key: string): string {
  if (key === 'fullName') return fullNameOf(user)
  const value = user[key as keyof MockUser]
  return String(value ?? '')
}

function applyUsersQuery(query: UsersQuery, actor: AuthUser) {
  const filtered = usersStore.filter((user) => {
    if (!canAccessData(actor, user)) return false
    if (query.username) {
      const haystack = [
        user.username,
        user.email,
        fullNameOf(user),
        user.phoneNumber,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query.username)) return false
    }
    if (query.status.length && !query.status.includes(user.status)) return false
    if (query.role.length && !query.role.includes(user.role)) return false
    return true
  })

  const direction = query.sortOrder === 'desc' ? -1 : 1
  filtered.sort(
    (left, right) =>
      sortValue(left, query.sortBy).localeCompare(
        sortValue(right, query.sortBy),
        'zh-Hans-CN'
      ) * direction
  )

  const total = filtered.length
  const totalPageCount = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(Math.max(1, query.page), totalPageCount)
  const start = (page - 1) * query.pageSize

  return {
    items: filtered.slice(start, start + query.pageSize).map((user) => ({
      ...user,
      departmentName:
        systemStore().records.find(
          (entry) =>
            entry.resource === 'departments' && entry.id === user.departmentId
        )?.name ?? user.departmentId,
    })),
    meta: { page, pageSize: query.pageSize, total, totalPageCount },
  }
}

type UserWriteBody = {
  firstName?: unknown
  lastName?: unknown
  username?: unknown
  email?: unknown
  phoneNumber?: unknown
  role?: unknown
  password?: unknown
  avatarUrl?: unknown
  departmentId?: unknown
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ROLES = new Set(['superadmin', 'admin', 'manager', 'cashier'])

function readUserBody(body: UserWriteBody | null) {
  const text = (value: unknown) =>
    typeof value === 'string' ? value.trim() : ''
  return {
    departmentId: text(body?.departmentId) || undefined,
    firstName: text(body?.firstName),
    lastName: text(body?.lastName),
    username: text(body?.username),
    email: text(body?.email),
    phoneNumber: text(body?.phoneNumber),
    role: text(body?.role),
    avatarUrl: text(body?.avatarUrl) || undefined,
  }
}

function validateUserFields(
  fields: ReturnType<typeof readUserBody>
): string | null {
  if (
    !fields.firstName ||
    !fields.lastName ||
    !fields.username ||
    !fields.email ||
    !fields.phoneNumber ||
    !fields.role
  ) {
    return '请完整填写必填字段。'
  }
  if (!EMAIL_PATTERN.test(fields.email)) return '邮箱格式不正确。'
  if (!ROLES.has(fields.role)) return '角色不在允许范围内。'
  return null
}

function actorOf(session: { user: { name: string; email: string } }) {
  return { actorName: session.user.name, actorEmail: session.user.email }
}

async function readJson(request: Request): Promise<UserWriteBody | null> {
  return (await request.json().catch(() => null)) as UserWriteBody | null
}

function readIds(body: unknown): string[] {
  const ids = (body as { ids?: unknown } | null)?.ids
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : []
}

function writableDepartment(actor: AuthUser, departmentId: string) {
  const scope = actor.dataScopes?.['users:write']
  return !!(
    scope &&
    (scope.all ||
      scope.departments.includes(departmentId) ||
      (scope.self && actor.departmentId === departmentId))
  )
}

export const usersHandlers = [
  http.get(`${mockBase}api/users`, ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied = requirePermission(session, 'users:read')
    if (denied) return denied

    return HttpResponse.json({
      data: applyUsersQuery(parseUsersQuery(request), session.user),
    })
  }),

  http.post(`${mockBase}api/users`, async ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const fields = readUserBody(await readJson(request))
    const invalid = validateUserFields(fields)
    if (invalid) return apiError(422, 'INVALID_USER_FIELDS', invalid)
    if (findUserByEmailOrUsername(fields.email, fields.username)) {
      return apiError(422, 'DUPLICATE_USER', '邮箱或用户名已存在。')
    }

    const now = new Date().toISOString()
    const created: MockUser = {
      id: createUserId(),
      createdBy: session.user.id,
      ...fields,
      departmentId: fields.departmentId ?? session.user.departmentId ?? '',
      role: fields.role as MockUser['role'],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    if (
      !canAccessData(session.user, created, 'users:write') ||
      !writableDepartment(session.user, created.departmentId) ||
      !systemStore().records.some(
        (record) =>
          record.resource === 'departments' &&
          record.enabled &&
          record.id === created.departmentId
      )
    )
      return apiError(403, 'DATA_SCOPE_DENIED', '所属部门超出范围或不可用。')
    usersStore.unshift(created)
    appendAuditLog({
      ...actorOf(session),
      action: 'user.created',
      target: `${created.username}（${created.email}）`,
      detail: `创建用户并分配角色 ${created.role}`,
      ip: '127.0.0.1',
    })
    return HttpResponse.json({ data: created }, { status: 201 })
  }),

  http.put(`${mockBase}api/users/:id`, async ({ request, params, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const existing = usersStore.find((user) => user.id === params.id)
    if (!existing) return apiError(404, 'USER_NOT_FOUND', '用户不存在。')
    if (!canAccessData(session.user, existing, 'users:write'))
      return apiError(403, 'DATA_SCOPE_DENIED', '数据超出当前范围。')

    const fields = readUserBody(await readJson(request))
    const invalid = validateUserFields(fields)
    if (invalid) return apiError(422, 'INVALID_USER_FIELDS', invalid)
    if (findUserByEmailOrUsername(fields.email, fields.username, existing.id)) {
      return apiError(422, 'DUPLICATE_USER', '邮箱或用户名已存在。')
    }

    const departmentId = fields.departmentId ?? existing.departmentId
    if (
      departmentId !== existing.departmentId &&
      !writableDepartment(session.user, departmentId)
    )
      return apiError(403, 'DATA_SCOPE_DENIED', '不能移到范围外的部门。')
    if (
      !canAccessData(
        session.user,
        { ...existing, departmentId },
        'users:write'
      ) ||
      !systemStore().records.some(
        (record) =>
          record.resource === 'departments' &&
          record.enabled &&
          record.id === departmentId
      )
    )
      return apiError(403, 'DATA_SCOPE_DENIED', '所属部门超出范围或不可用。')
    Object.assign(existing, fields, {
      departmentId,
      role: fields.role as MockUser['role'],
      updatedAt: new Date().toISOString(),
    })
    appendAuditLog({
      ...actorOf(session),
      action: 'user.updated',
      target: `${existing.username}（${existing.email}）`,
      detail: '更新用户资料',
      ip: '127.0.0.1',
    })
    return HttpResponse.json({ data: existing })
  }),

  http.delete(`${mockBase}api/users/:id`, ({ request, params, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const index = usersStore.findIndex((user) => user.id === params.id)
    if (index < 0) return apiError(404, 'USER_NOT_FOUND', '用户不存在。')

    if (!canAccessData(session.user, usersStore[index], 'users:write'))
      return apiError(403, 'DATA_SCOPE_DENIED', '数据超出当前范围。')
    const [removed] = usersStore.splice(index, 1)
    appendAuditLog({
      ...actorOf(session),
      action: 'user.deleted',
      target: `${removed.username}（${removed.email}）`,
      detail: '删除用户',
      ip: '127.0.0.1',
    })
    return HttpResponse.json({ data: { success: true } })
  }),

  http.post(
    `${mockBase}api/users/batch-delete`,
    async ({ request, cookies }) => {
      const session = currentSession(cookies)
      if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
      const denied =
        requirePermission(session, 'users:write') ??
        requireCsrf(request, session)
      if (denied) return denied

      const ids = new Set(readIds(await readJson(request)))
      if (
        usersStore.some(
          (user) =>
            ids.has(user.id) &&
            !canAccessData(session.user, user, 'users:write')
        )
      )
        return apiError(
          403,
          'DATA_SCOPE_DENIED',
          '批量操作包含范围外数据，未执行任何更改。'
        )
      const removed: MockUser[] = []
      for (let index = usersStore.length - 1; index >= 0; index -= 1) {
        if (ids.has(usersStore[index].id))
          removed.push(usersStore.splice(index, 1)[0])
      }
      appendAuditLog({
        ...actorOf(session),
        action: 'user.batch_deleted',
        target: `${removed.length} 个用户`,
        detail: removed.length
          ? `批量删除 ${removed.length} 个用户`
          : '未匹配到用户',
        ip: '127.0.0.1',
      })
      return HttpResponse.json({ data: { deletedCount: removed.length } })
    }
  ),

  http.patch(`${mockBase}api/users/status`, async ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const body = (await request.json().catch(() => null)) as {
      ids?: unknown
      status?: unknown
    } | null
    const status = body?.status
    if (status !== 'active' && status !== 'inactive') {
      return apiError(422, 'INVALID_STATUS', '状态只允许启用或停用。')
    }
    const ids = new Set(readIds(body))
    if (
      usersStore.some(
        (user) =>
          ids.has(user.id) && !canAccessData(session.user, user, 'users:write')
      )
    )
      return apiError(
        403,
        'DATA_SCOPE_DENIED',
        '批量操作包含范围外数据，未执行任何更改。'
      )
    let updatedCount = 0
    for (const user of usersStore) {
      if (!ids.has(user.id)) continue
      user.status = status
      user.updatedAt = new Date().toISOString()
      updatedCount += 1
    }
    appendAuditLog({
      ...actorOf(session),
      action: 'user.status_changed',
      target: `${updatedCount} 个用户`,
      detail: `批量变更为${status === 'active' ? '启用' : '停用'}`,
      ip: '127.0.0.1',
    })
    return HttpResponse.json({ data: { updatedCount } })
  }),

  http.post(`${mockBase}api/users/invite`, async ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const body = (await request.json().catch(() => null)) as {
      email?: unknown
      role?: unknown
    } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    if (!EMAIL_PATTERN.test(email))
      return apiError(422, 'INVALID_EMAIL', '请输入有效邮箱。')
    if (!ROLES.has(role))
      return apiError(422, 'INVALID_ROLE', '角色不在允许范围内。')

    const username = email.split('@')[0].toLowerCase()
    if (findUserByEmailOrUsername(email, username)) {
      return apiError(422, 'DUPLICATE_USER', '该邮箱已被邀请或已存在。')
    }

    const now = new Date().toISOString()
    const invited: MockUser = {
      id: createUserId(),
      departmentId: session.user.departmentId ?? '',
      createdBy: session.user.id,
      firstName: '待',
      lastName: '邀请',
      username,
      email,
      phoneNumber: '—',
      role: role as MockUser['role'],
      status: 'invited',
      createdAt: now,
      updatedAt: now,
    }
    if (!canAccessData(session.user, invited, 'users:write'))
      return apiError(403, 'DATA_SCOPE_DENIED', '所属部门超出当前范围。')
    usersStore.unshift(invited)
    appendAuditLog({
      ...actorOf(session),
      action: 'user.invited',
      target: `${invited.username}（${invited.email}）`,
      detail: `邀请加入并分配角色 ${invited.role}`,
      ip: '127.0.0.1',
    })
    return HttpResponse.json({ data: invited }, { status: 201 })
  }),

  http.post(
    `${mockBase}api/users/invite-batch`,
    async ({ request, cookies }) => {
      const session = currentSession(cookies)
      if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
      const denied =
        requirePermission(session, 'users:write') ??
        requireCsrf(request, session)
      if (denied) return denied

      const ids = new Set(readIds(await readJson(request)))
      if (
        usersStore.some(
          (user) =>
            ids.has(user.id) &&
            !canAccessData(session.user, user, 'users:write')
        )
      )
        return apiError(
          403,
          'DATA_SCOPE_DENIED',
          '批量操作包含范围外数据，未执行任何更改。'
        )
      let invitedCount = 0
      for (const user of usersStore) {
        if (!ids.has(user.id) || user.status === 'invited') continue
        user.status = 'invited'
        user.updatedAt = new Date().toISOString()
        invitedCount += 1
      }
      appendAuditLog({
        ...actorOf(session),
        action: 'user.batch_invited',
        target: `${invitedCount} 个用户`,
        detail: `批量邀请 ${invitedCount} 个用户`,
        ip: '127.0.0.1',
      })
      return HttpResponse.json({ data: { invitedCount } })
    }
  ),
]
