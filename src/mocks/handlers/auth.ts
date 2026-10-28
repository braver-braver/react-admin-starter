import { HttpResponse, http } from 'msw'
import { getCookie } from '@/lib/cookies'
import { type Permission } from '@/lib/permissions'
import { type AuthUser, loginSchema } from '@/features/auth/schema'
import { appendAuditLog } from '../data/audit'

/**
 * 演示用会话：随机会话 ID 放在 Cookie，会话库放在当前标签页的 sessionStorage。
 * 仅供开发与测试；生产构建会排除整个 MSW 目录。
 */
export type MockSession = {
  user: AuthUser
  csrfToken: string
  expiresAt: number
}

const SESSION_KEY = 'react-admin-starter:mock-sessions'
export const COOKIE_NAME = 'mock_session'
export const DEMO_PASSWORD = 'Demo1234!'
const SESSION_LIFETIME_MS = 60 * 60 * 1000

const demoUsers: Record<string, AuthUser> = {
  'admin@example.com': {
    id: 'demo-admin',
    email: 'admin@example.com',
    name: '演示管理员',
    roles: ['admin'],
    permissions: [
      'users:read',
      'users:write',
      'permissions:read',
      'audit:read',
    ],
  },
  'viewer@example.com': {
    id: 'demo-viewer',
    email: 'viewer@example.com',
    name: '演示只读用户',
    roles: ['viewer'],
    permissions: ['users:read', 'permissions:read'],
  },
  'guest@example.com': {
    id: 'demo-guest',
    email: 'guest@example.com',
    name: '演示受限用户',
    roles: ['guest'],
    permissions: [],
  },
}

function readSessions(): Record<string, MockSession> {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    return stored ? (JSON.parse(stored) as Record<string, MockSession>) : {}
  } catch {
    return {}
  }
}

function writeSessions(sessions: Record<string, MockSession>) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessions))
}

function getSession(id: string | undefined): MockSession | undefined {
  if (!id || getCookie(COOKIE_NAME) !== id) return undefined

  const sessions = readSessions()
  const session = sessions[id]
  if (!session) return undefined
  if (session.expiresAt <= Date.now()) {
    delete sessions[id]
    writeSessions(sessions)
    return undefined
  }
  return session
}

export function apiError(
  status: 400 | 401 | 403 | 404 | 409 | 422,
  code: string,
  message: string
) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

function requiresRequestedWith(request: Request) {
  return request.headers.get('X-Requested-With') === 'ReactAdminStarter'
}

function sessionCookie(id: string) {
  return `${COOKIE_NAME}=${id}; Path=/; SameSite=Lax; Max-Age=3600`
}

function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`
}

// This database and cookie are exclusively for the development MSW demo.
export function resetMockSessions() {
  sessionStorage.removeItem(SESSION_KEY)
  document.cookie = expiredSessionCookie()
}

/** 从请求 Cookie 解析当前演示会话；未登录返回 undefined。 */
export function currentSession(
  cookies: Record<string, string>
): MockSession | undefined {
  return getSession(cookies[COOKIE_NAME])
}

/** 写操作的来源校验：CSRF 令牌必须与当前会话一致。 */
export function requireCsrf(
  request: Request,
  session: MockSession
): Response | null {
  if (request.headers.get('X-CSRF-Token') !== session.csrfToken) {
    return apiError(403, 'INVALID_CSRF_TOKEN', '请求令牌无效。')
  }
  return null
}

/** 服务端权限校验：缺失的权限一律拒绝。 */
export function requirePermission(
  session: MockSession,
  permission: Permission
): Response | null {
  if (!session.user.permissions.includes(permission)) {
    return apiError(403, 'FORBIDDEN', '没有执行该操作的权限。')
  }
  return null
}

function auditAuthEvent(
  session: MockSession,
  action: 'auth.sign_in' | 'auth.sign_out'
) {
  appendAuditLog({
    actorName: session.user.name,
    actorEmail: session.user.email,
    action,
    target: session.user.email,
    detail: action === 'auth.sign_in' ? '登录管理端' : '退出登录',
    ip: '127.0.0.1',
  })
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request, cookies }) => {
    if (!requiresRequestedWith(request)) {
      return apiError(403, 'REQUEST_HEADER_REQUIRED', '缺少请求来源标识。')
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError(400, 'INVALID_REQUEST', '请求内容必须是 JSON。')
    }

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success)
      return apiError(
        400,
        'INVALID_CREDENTIALS_FORMAT',
        '请输入有效的邮箱和密码。'
      )

    const user = demoUsers[parsed.data.email.toLowerCase()]
    if (!user || parsed.data.password !== DEMO_PASSWORD) {
      return apiError(401, 'INVALID_CREDENTIALS', '邮箱或密码错误。')
    }

    const sessionId = crypto.randomUUID()
    const session: MockSession = {
      user,
      csrfToken: crypto.randomUUID(),
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
    }
    const sessions = readSessions()
    for (const [id, stored] of Object.entries(sessions)) {
      if (id === cookies[COOKIE_NAME] || stored.expiresAt <= Date.now())
        delete sessions[id]
    }
    writeSessions({ ...sessions, [sessionId]: session })
    auditAuthEvent(session, 'auth.sign_in')

    return HttpResponse.json(
      { data: { user: session.user, csrfToken: session.csrfToken } },
      { headers: { 'Set-Cookie': sessionCookie(sessionId) } }
    )
  }),

  http.get('/api/auth/session', ({ cookies }) => {
    const session = getSession(cookies[COOKIE_NAME])
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')

    return HttpResponse.json({
      data: { user: session.user, csrfToken: session.csrfToken },
    })
  }),

  http.post('/api/auth/logout', ({ request, cookies }) => {
    if (!requiresRequestedWith(request)) {
      return apiError(403, 'REQUEST_HEADER_REQUIRED', '缺少请求来源标识。')
    }

    const sessionId = cookies[COOKIE_NAME]
    const session = getSession(sessionId)
    if (!sessionId || !session)
      return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const csrfDenied = requireCsrf(request, session)
    if (csrfDenied) return csrfDenied

    auditAuthEvent(session, 'auth.sign_out')
    const sessions = readSessions()
    delete sessions[sessionId]
    writeSessions(sessions)
    return HttpResponse.json(
      { data: { success: true } },
      { headers: { 'Set-Cookie': expiredSessionCookie() } }
    )
  }),

  http.get('/api/auth/permissions', ({ cookies }) => {
    const session = getSession(cookies[COOKIE_NAME])
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied = requirePermission(session, 'permissions:read')
    if (denied) return denied

    return HttpResponse.json({
      data: {
        roles: session.user.roles,
        permissions: session.user.permissions,
      },
    })
  }),
]
