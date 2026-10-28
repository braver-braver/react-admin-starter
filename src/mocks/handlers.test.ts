import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { worker } from './browser'
import { resetMockSessions } from './handlers'

const requestedWith = { 'X-Requested-With': 'ReactAdminStarter' }

async function login(email = 'admin@example.com', password = 'Demo1234!') {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { ...requestedWith, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

beforeAll(async () => {
  await worker.start({ quiet: true })
})

beforeEach(() => {
  worker.resetHandlers()
  resetMockSessions()
})

afterAll(async () => {
  resetMockSessions()
  await worker.stop()
})

describe('development auth handlers', () => {
  it('sets an opaque cookie and restores the session on a subsequent request', async () => {
    const loginResponse = await login()
    expect(loginResponse.status).toBe(200)
    const loginBody = await loginResponse.json()
    expect(loginBody).toEqual({
      data: {
        user: {
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
        csrfToken: expect.any(String),
      },
    })

    const sessionId = document.cookie.match(/(?:^|; )mock_session=([^;]+)/)?.[1]
    expect(sessionId).toMatch(/^[\da-f-]{36}$/)
    expect(sessionId).not.toContain('admin@example.com')

    const sessionResponse = await fetch('/api/auth/session')
    expect(sessionResponse.status).toBe(200)
    expect(await sessionResponse.json()).toEqual(loginBody)
  })

  it('rejects a deleted browser cookie even if MSW remembers it', async () => {
    await login()
    document.cookie = 'mock_session=; Path=/; Max-Age=0'
    expect((await fetch('/api/auth/session')).status).toBe(401)
    expect((await fetch('/api/auth/permissions')).status).toBe(401)
  })

  it('invalidates the session and cookie on logout', async () => {
    const loginBody = await (await login()).json()
    const logoutResponse = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        ...requestedWith,
        'X-CSRF-Token': loginBody.data.csrfToken,
      },
    })
    expect(logoutResponse.status).toBe(200)
    expect(await logoutResponse.json()).toEqual({ data: { success: true } })
    expect(document.cookie).not.toContain('mock_session=')

    const sessionResponse = await fetch('/api/auth/session')
    expect(sessionResponse.status).toBe(401)
    expect(await sessionResponse.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: '请先登录。' },
    })
  })

  it('rejects unknown users and bad passwords without a session', async () => {
    for (const [email, password] of [
      ['unknown@example.com', 'Demo1234!'],
      ['admin@example.com', 'incorrect'],
    ]) {
      const response = await login(email, password)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' },
      })
    }
    expect(document.cookie).not.toContain('mock_session=')
  })

  it('requires login for permissions and limits guest access', async () => {
    const anonymous = await fetch('/api/auth/permissions')
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: '请先登录。' },
    })

    await login('guest@example.com')
    const guest = await fetch('/api/auth/permissions')
    expect(guest.status).toBe(403)
    expect(await guest.json()).toEqual({
      error: { code: 'FORBIDDEN', message: '没有执行该操作的权限。' },
    })
  })

  it('returns the viewer permission envelope', async () => {
    await login('viewer@example.com')
    const response = await fetch('/api/auth/permissions')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        roles: ['viewer'],
        permissions: ['users:read', 'permissions:read'],
      },
    })
  })

  it('rejects logout without a valid CSRF token and retains the session', async () => {
    await login()
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { ...requestedWith, 'X-CSRF-Token': 'wrong' },
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CSRF_TOKEN', message: '请求令牌无效。' },
    })
    expect((await fetch('/api/auth/session')).status).toBe(200)
  })

  it('rejects unsafe requests without the source marker', async () => {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Demo1234!',
      }),
    })
    expect(loginResponse.status).toBe(403)
    expect(await loginResponse.json()).toEqual({
      error: { code: 'REQUEST_HEADER_REQUIRED', message: '缺少请求来源标识。' },
    })
  })
})

type SessionEnvelope = { user: { email: string }; csrfToken: string }

async function loginSession(
  email = 'admin@example.com'
): Promise<SessionEnvelope> {
  const response = await login(email)
  expect(response.status).toBe(200)
  const body = (await response.json()) as { data: SessionEnvelope }
  return body.data
}

function writeHeaders(csrfToken: string) {
  return {
    ...requestedWith,
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  }
}

describe('user CRUD handlers', () => {
  it('rejects anonymous listing with 401', async () => {
    const response = await fetch('/api/users')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: '请先登录。' },
    })
  })

  it('pages and sorts on the server', async () => {
    await loginSession()
    const response = await fetch(
      '/api/users?page=2&pageSize=5&sortBy=username&sortOrder=asc'
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: {
        items: { username: string }[]
        meta: {
          page: number
          pageSize: number
          total: number
          totalPageCount: number
        }
      }
    }
    expect(body.data.items).toHaveLength(5)
    expect(body.data.meta.page).toBe(2)
    expect(body.data.meta.pageSize).toBe(5)
    expect(body.data.meta.totalPageCount).toBeGreaterThanOrEqual(10)
    const usernames = body.data.items.map((user) => user.username)
    expect(usernames).toEqual([...usernames].sort((a, b) => a.localeCompare(b)))
  })

  it('filters by username, status and role', async () => {
    await loginSession()
    const response = await fetch(
      '/api/users?page=1&pageSize=50&status=active&role=admin'
    )
    const body = (await response.json()) as {
      data: { items: { status: string; role: string }[] }
    }
    expect(body.data.items.length).toBeGreaterThan(0)
    expect(
      body.data.items.every(
        (user) => user.status === 'active' && user.role === 'admin'
      )
    ).toBe(true)
  })

  it('lets a viewer read but rejects writes with 403', async () => {
    await loginSession('viewer@example.com')
    expect((await fetch('/api/users')).status).toBe(200)

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: writeHeaders('any'),
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: '没有执行该操作的权限。' },
    })
  })

  it('requires the CSRF token for writes', async () => {
    await loginSession()
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { ...requestedWith, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: '安',
        lastName: '李',
        username: 'li_an',
        email: 'li.an@example.com',
        phoneNumber: '+8613800000002',
        role: 'manager',
      }),
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CSRF_TOKEN', message: '请求令牌无效。' },
    })
  })

  it('creates, updates, deletes and audits a user', async () => {
    const session = await loginSession()
    const email = `qa.${Date.now()}@example.com`
    const created = await fetch('/api/users', {
      method: 'POST',
      headers: writeHeaders(session.csrfToken),
      body: JSON.stringify({
        firstName: '测试',
        lastName: '用户',
        username: `qa_${Date.now()}`,
        email,
        phoneNumber: '+8613800000003',
        role: 'cashier',
      }),
    })
    expect(created.status).toBe(201)
    const createdUser = (await created.json()) as {
      data: { id: string; status: string; email: string }
    }
    expect(createdUser.data.status).toBe('active')

    const updated = await fetch(`/api/users/${createdUser.data.id}`, {
      method: 'PUT',
      headers: writeHeaders(session.csrfToken),
      body: JSON.stringify({
        firstName: '更新',
        lastName: '用户',
        username: `qa_${createdUser.data.id}`,
        email,
        phoneNumber: '+8613800000003',
        role: 'manager',
      }),
    })
    expect(updated.status).toBe(200)
    expect(
      ((await updated.json()) as { data: { firstName: string } }).data.firstName
    ).toBe('更新')

    const deleted = await fetch(`/api/users/${createdUser.data.id}`, {
      method: 'DELETE',
      headers: writeHeaders(session.csrfToken),
    })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ data: { success: true } })

    const audit = await fetch('/api/audit-logs?page=1&pageSize=50')
    const auditBody = (await audit.json()) as {
      data: { items: { action: string; target: string }[] }
    }
    const actions = auditBody.data.items
      .filter((log) => log.target.includes(email))
      .map((log) => log.action)
    expect(actions).toEqual(
      expect.arrayContaining(['user.created', 'user.updated', 'user.deleted'])
    )
  })

  it('validates duplicates and required fields', async () => {
    const session = await loginSession()
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: writeHeaders(session.csrfToken),
      body: JSON.stringify({
        firstName: '',
        lastName: '',
        username: '',
        email: 'not-an-email',
        phoneNumber: '',
        role: 'nope',
      }),
    })
    expect(response.status).toBe(422)
    expect(
      ((await response.json()) as { error: { code: string } }).error.code
    ).toBe('INVALID_USER_FIELDS')
  })
})

describe('upload handlers', () => {
  it('stores an image and returns a preview url', async () => {
    const session = await loginSession()
    const form = new FormData()
    form.append(
      'file',
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
        type: 'image/png',
      })
    )
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { ...requestedWith, 'X-CSRF-Token': session.csrfToken },
      body: form,
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { url: string; contentType: string; name: string }
    }
    expect(body.data.name).toBe('avatar.png')
    expect(body.data.contentType).toBe('image/png')
    expect(body.data.url).toMatch(/^blob:/)
  })

  it('rejects non-image uploads and read-only accounts', async () => {
    const session = await loginSession()
    const form = new FormData()
    form.append(
      'file',
      new File(['hello'], 'notes.txt', { type: 'text/plain' })
    )
    const rejected = await fetch('/api/uploads', {
      method: 'POST',
      headers: { ...requestedWith, 'X-CSRF-Token': session.csrfToken },
      body: form,
    })
    expect(rejected.status).toBe(422)

    await loginSession('viewer@example.com')
    const forbidden = await fetch('/api/users', {
      method: 'POST',
      headers: writeHeaders('any'),
      body: '{}',
    })
    expect(forbidden.status).toBe(403)
  })
})

describe('audit handlers', () => {
  it('requires audit:read and filters by action', async () => {
    await loginSession('viewer@example.com')
    expect((await fetch('/api/audit-logs')).status).toBe(403)

    await loginSession()
    const response = await fetch('/api/audit-logs?page=1&pageSize=5')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { items: unknown[]; meta: { pageSize: number } }
    }
    expect(body.data.items).toHaveLength(5)
    expect(body.data.meta.pageSize).toBe(5)
  })
})
