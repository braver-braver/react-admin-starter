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
          permissions: ['users:read', 'users:write', 'permissions:read'],
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
      error: { code: 'FORBIDDEN', message: '无权读取权限信息。' },
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
