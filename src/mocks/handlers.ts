import { HttpResponse, http } from 'msw'
import { getCookie } from '@/lib/cookies'
import { type AuthUser, loginSchema } from '@/features/auth/schema'

type MockSession = {
  user: AuthUser
  csrfToken: string
  expiresAt: number
}

const mockBase = import.meta.env.BASE_URL
const SESSION_KEY =
  mockBase === '/'
    ? 'react-admin-starter:mock-sessions'
    : `react-admin-starter:mock-sessions:${mockBase}`
const COOKIE_NAME =
  mockBase === '/'
    ? 'mock_session'
    : `mock_session_${encodeURIComponent(mockBase)}`
const SESSION_LIFETIME_MS = 60 * 60 * 1000
const DEMO_PASSWORD = 'Demo1234!'

const demoUsers: Record<string, AuthUser> = {
  'admin@example.com': {
    id: 'demo-admin',
    email: 'admin@example.com',
    name: '演示管理员',
    roles: ['admin'],
    permissions: ['users:read', 'users:write', 'permissions:read'],
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

function error(status: 400 | 401 | 403, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

function requiresRequestedWith(request: Request) {
  return request.headers.get('X-Requested-With') === 'ReactAdminStarter'
}

function sessionCookie(id: string) {
  return `${COOKIE_NAME}=${id}; Path=${mockBase}; SameSite=Lax; Max-Age=3600`
}

function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=${mockBase}; SameSite=Lax; Max-Age=0`
}

// This database and cookie are exclusively for development and the explicit static MSW demo.
export function resetMockSessions() {
  sessionStorage.removeItem(SESSION_KEY)
  document.cookie = expiredSessionCookie()
}

export const handlers = [
  http.post(`${mockBase}api/auth/login`, async ({ request, cookies }) => {
    if (!requiresRequestedWith(request)) {
      return error(403, 'REQUEST_HEADER_REQUIRED', '缺少请求来源标识。')
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return error(400, 'INVALID_REQUEST', '请求内容必须是 JSON。')
    }

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success)
      return error(
        400,
        'INVALID_CREDENTIALS_FORMAT',
        '请输入有效的邮箱和密码。'
      )

    const user = demoUsers[parsed.data.email.toLowerCase()]
    if (!user || parsed.data.password !== DEMO_PASSWORD) {
      return error(401, 'INVALID_CREDENTIALS', '邮箱或密码错误。')
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

    return HttpResponse.json(
      { data: { user: session.user, csrfToken: session.csrfToken } },
      { headers: { 'Set-Cookie': sessionCookie(sessionId) } }
    )
  }),

  http.get(`${mockBase}api/auth/session`, ({ cookies }) => {
    const session = getSession(cookies[COOKIE_NAME])
    if (!session) return error(401, 'UNAUTHENTICATED', '请先登录。')

    return HttpResponse.json({
      data: { user: session.user, csrfToken: session.csrfToken },
    })
  }),

  http.post(`${mockBase}api/auth/logout`, ({ request, cookies }) => {
    if (!requiresRequestedWith(request)) {
      return error(403, 'REQUEST_HEADER_REQUIRED', '缺少请求来源标识。')
    }

    const sessionId = cookies[COOKIE_NAME]
    const session = getSession(sessionId)
    if (!sessionId || !session)
      return error(401, 'UNAUTHENTICATED', '请先登录。')
    if (request.headers.get('X-CSRF-Token') !== session.csrfToken) {
      return error(403, 'INVALID_CSRF_TOKEN', '请求令牌无效。')
    }

    const sessions = readSessions()
    delete sessions[sessionId]
    writeSessions(sessions)
    return HttpResponse.json(
      { data: { success: true } },
      { headers: { 'Set-Cookie': expiredSessionCookie() } }
    )
  }),

  http.get(`${mockBase}api/auth/permissions`, ({ cookies }) => {
    const session = getSession(cookies[COOKIE_NAME])
    if (!session) return error(401, 'UNAUTHENTICATED', '请先登录。')
    if (!session.user.permissions.includes('permissions:read')) {
      return error(403, 'FORBIDDEN', '无权读取权限信息。')
    }

    return HttpResponse.json({
      data: {
        roles: session.user.roles,
        permissions: session.user.permissions,
      },
    })
  }),
]
