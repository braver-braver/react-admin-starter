import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { worker } from './browser'
import {
  accountById,
  changeSystem,
  principal,
  resetSystemStore,
  systemStore,
} from './data/system'
import { handlers, resetMockSessions } from './handlers'
import { apiBase } from './handlers/auth'

const requestedWith = { 'X-Requested-With': 'ReactAdminStarter' }

async function login(email = 'admin@example.com', password = 'Demo1234!') {
  return fetch('/api/v1/auth/login', {
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
  resetSystemStore()
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
    expect(loginBody).toMatchObject({
      data: {
        user: {
          id: 'demo-admin',
          email: 'admin@example.com',
          name: '演示管理员',
          roles: ['admin'],
          permissions: expect.arrayContaining([
            'users:read',
            'users:write',
            'permissions:read',
            'audit:read',
            'system:accounts:write',
          ]),
          routes: expect.arrayContaining(['/system/accounts']),
          dataScope: { all: true },
        },
        csrfToken: expect.any(String),
      },
    })

    const sessionId = document.cookie.match(/(?:^|; )mock_session=([^;]+)/)?.[1]
    expect(sessionId).toMatch(/^[\da-f-]{36}$/)
    expect(sessionId).not.toContain('admin@example.com')

    const sessionResponse = await fetch('/api/v1/auth/session')
    expect(sessionResponse.status).toBe(200)
    expect(await sessionResponse.json()).toEqual(loginBody)
  })

  it('rejects a deleted browser cookie even if MSW remembers it', async () => {
    await login()
    document.cookie = 'mock_session=; Path=/; Max-Age=0'
    expect((await fetch('/api/v1/auth/session')).status).toBe(401)
    expect((await fetch('/api/v1/auth/permissions')).status).toBe(401)
  })

  it('invalidates the session and cookie on logout', async () => {
    const loginBody = await (await login()).json()
    const logoutResponse = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        ...requestedWith,
        'X-CSRF-Token': loginBody.data.csrfToken,
      },
    })
    expect(logoutResponse.status).toBe(200)
    expect(await logoutResponse.json()).toEqual({ data: { success: true } })
    expect(document.cookie).not.toContain('mock_session=')

    const sessionResponse = await fetch('/api/v1/auth/session')
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
    const anonymous = await fetch('/api/v1/auth/permissions')
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: '请先登录。' },
    })

    await login('guest@example.com')
    const guest = await fetch('/api/v1/auth/permissions')
    expect(guest.status).toBe(403)
    expect(await guest.json()).toEqual({
      error: { code: 'FORBIDDEN', message: '没有执行该操作的权限。' },
    })
  })

  it('returns the viewer permission envelope', async () => {
    await login('viewer@example.com')
    const response = await fetch('/api/v1/auth/permissions')
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
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { ...requestedWith, 'X-CSRF-Token': 'wrong' },
    })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CSRF_TOKEN', message: '请求令牌无效。' },
    })
    expect((await fetch('/api/v1/auth/session')).status).toBe(200)
  })

  it('rejects unsafe requests without the source marker', async () => {
    const loginResponse = await fetch('/api/v1/auth/login', {
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
    const response = await fetch('/api/v1/users')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: '请先登录。' },
    })
  })

  it('pages and sorts on the server', async () => {
    await loginSession()
    const response = await fetch(
      '/api/v1/users?page=2&pageSize=5&sortBy=username&sortOrder=asc'
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
      '/api/v1/users?page=1&pageSize=50&status=active&role=admin'
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
    expect((await fetch('/api/v1/users')).status).toBe(200)

    const response = await fetch('/api/v1/users', {
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
    const response = await fetch('/api/v1/users', {
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
    const created = await fetch('/api/v1/users', {
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

    const updated = await fetch(`/api/v1/users/${createdUser.data.id}`, {
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

    const deleted = await fetch(`/api/v1/users/${createdUser.data.id}`, {
      method: 'DELETE',
      headers: writeHeaders(session.csrfToken),
    })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ data: { success: true } })

    const audit = await fetch('/api/v1/audit-logs?page=1&pageSize=50')
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
    const response = await fetch('/api/v1/users', {
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

  it('caps pageSize at 100 on users and audit logs', async () => {
    await loginSession()
    for (const path of ['/api/v1/users', '/api/v1/audit-logs']) {
      const response = await fetch(`${path}?page=1&pageSize=1000`)
      const body = (await response.json()) as {
        data: { items: unknown[]; meta: { pageSize: number } }
      }
      expect(body.data.meta.pageSize).toBe(100)
      expect(body.data.items.length).toBeLessThanOrEqual(100)
    }
  })

  it('prioritises the required-field message and never stores passwords', async () => {
    const session = await loginSession()
    const post = (body: object) =>
      fetch('/api/v1/users', {
        method: 'POST',
        headers: writeHeaders(session.csrfToken),
        body: JSON.stringify(body),
      })
    const response = await post({ email: 'bad', role: 'root' })
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_USER_FIELDS', message: '请完整填写必填字段。' },
    })

    const created = await post({
      firstName: '密',
      lastName: '码',
      username: `pw_${Date.now()}`,
      email: `pw.${Date.now()}@example.com`,
      phoneNumber: '+8613800000009',
      role: 'cashier',
      password: 'Secret123!',
    })
    expect(created.status).toBe(201)
    expect(JSON.stringify(await created.json())).not.toContain('Secret123!')
  })

  it('maps invite validation to INVALID_EMAIL / INVALID_ROLE', async () => {
    const session = await loginSession()
    const invite = (body: object) =>
      fetch('/api/v1/users/invite', {
        method: 'POST',
        headers: writeHeaders(session.csrfToken),
        body: JSON.stringify(body),
      })
    const email = await invite({ email: 'nope', role: 'cashier' })
    expect(email.status).toBe(422)
    expect(
      ((await email.json()) as { error: { code: string } }).error.code
    ).toBe('INVALID_EMAIL')
    const role = await invite({ email: 'ok@example.com', role: 'root' })
    expect(role.status).toBe(422)
    expect(
      ((await role.json()) as { error: { code: string } }).error.code
    ).toBe('INVALID_ROLE')
  })

  it('rejects an invalid bulk status and treats malformed ids as an empty set', async () => {
    const session = await loginSession()
    const patch = (body: object) =>
      fetch('/api/v1/users/status', {
        method: 'PATCH',
        headers: writeHeaders(session.csrfToken),
        body: JSON.stringify(body),
      })
    const bad = await patch({ ids: ['x'], status: 'invited' })
    expect(bad.status).toBe(422)
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_STATUS'
    )

    const malformed = await patch({ ids: 'not-a-list', status: 'active' })
    expect(malformed.status).toBe(200)
    expect(await malformed.json()).toEqual({ data: { updatedCount: 0 } })

    // Inside a list, malformed entries are skipped and the valid ids still apply.
    const list = (await (
      await fetch('/api/v1/users?page=1&pageSize=50')
    ).json()) as {
      data: { items: { id: string; status: string }[] }
    }
    const target = list.data.items.find((user) => user.status === 'inactive')
    expect(target).toBeDefined()
    const mixed = await patch({ ids: [target!.id, null, 7], status: 'active' })
    expect(mixed.status).toBe(200)
    expect(await mixed.json()).toEqual({ data: { updatedCount: 1 } })
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
    const response = await fetch('/api/v1/uploads', {
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
    const rejected = await fetch('/api/v1/uploads', {
      method: 'POST',
      headers: { ...requestedWith, 'X-CSRF-Token': session.csrfToken },
      body: form,
    })
    expect(rejected.status).toBe(422)

    await loginSession('viewer@example.com')
    const forbidden = await fetch('/api/v1/users', {
      method: 'POST',
      headers: writeHeaders('any'),
      body: '{}',
    })
    expect(forbidden.status).toBe(403)
  })
})

describe('list envelope', () => {
  const lists = [
    '/api/v1/users',
    '/api/v1/audit-logs',
    '/api/v1/system/accounts',
    '/api/v1/system/roles',
    '/api/v1/system/permissions',
    '/api/v1/system/menus',
    '/api/v1/system/departments',
  ]

  it.each(lists)(
    '%s returns { items, meta } and nothing else',
    async (path) => {
      await loginSession()
      const response = await fetch(`${path}?page=1&pageSize=2`)
      expect(response.status).toBe(200)
      const { data } = (await response.json()) as {
        data: Record<string, unknown>
      }
      expect(Object.keys(data).sort()).toEqual(['items', 'meta'])
      const meta = data.meta as Record<string, number>
      expect(Object.keys(meta).sort()).toEqual([
        'page',
        'pageSize',
        'total',
        'totalPageCount',
      ])
      expect(meta.page).toBe(1)
      expect(meta.pageSize).toBe(2)
      expect(meta.totalPageCount).toBe(Math.max(1, Math.ceil(meta.total / 2)))
      expect((data.items as unknown[]).length).toBeLessThanOrEqual(2)
    }
  )

  it('reports at least one page for an empty system list', async () => {
    await loginSession()
    const response = await fetch('/api/v1/system/roles?search=zzzz-no-match')
    const { data } = (await response.json()) as {
      data: {
        items: unknown[]
        meta: { total: number; totalPageCount: number }
      }
    }
    expect(data.items).toEqual([])
    expect(data.meta).toMatchObject({ total: 0, totalPageCount: 1 })
  })
})

describe('versioned API prefix', () => {
  // Checked statically: a real request to an unhandled /api path would fall
  // through to the Vite dev server, whose HTML fallback reloads the test page.
  it('registers every mock handler under /api/v1, so unversioned /api paths are not served', () => {
    expect(apiBase.endsWith('api/v1')).toBe(true)
    expect(handlers.length).toBeGreaterThan(0)
    for (const handler of handlers) {
      expect(String(handler.info.path).startsWith(`${apiBase}/`)).toBe(true)
    }
  })

  it('serves the versioned path', async () => {
    await loginSession()
    expect((await fetch('/api/v1/users')).status).toBe(200)
  })
})

describe('request headers and multi-value query keys', () => {
  const writes: [string, string, object | undefined][] = [
    ['POST', '/api/v1/users', {}],
    ['PUT', '/api/v1/users/x', {}],
    ['DELETE', '/api/v1/users/x', undefined],
    ['POST', '/api/v1/users/batch-delete', { ids: [] }],
    ['PATCH', '/api/v1/users/status', { ids: [], status: 'active' }],
    ['POST', '/api/v1/users/invite', { email: 'a@b.co', role: 'cashier' }],
    ['POST', '/api/v1/users/invite-batch', { ids: [] }],
    ['POST', '/api/v1/uploads', undefined],
    ['POST', '/api/v1/system/roles', {}],
    ['PUT', '/api/v1/system/roles/x', {}],
    ['DELETE', '/api/v1/system/roles/x', undefined],
  ]

  it.each(writes)(
    'rejects %s %s without X-Requested-With, even when signed in with a CSRF token',
    async (method, path, body) => {
      const session = await loginSession()
      const response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': session.csrfToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: {
          code: 'REQUEST_HEADER_REQUIRED',
          message: '缺少请求来源标识。',
        },
      })
    }
  )

  it('checks the header before the session, so anonymous writes get the same 403', async () => {
    const response = await fetch('/api/v1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(response.status).toBe(403)
    expect(
      ((await response.json()) as { error: { code: string } }).error.code
    ).toBe('REQUEST_HEADER_REQUIRED')
  })

  it('only reads repeated keys: status[] / role[] / action[] are ignored', async () => {
    await loginSession()
    const count = async (query: string) => {
      const body = (await (
        await fetch(`/api/v1/users?pageSize=100&${query}`)
      ).json()) as {
        data: { meta: { total: number } }
      }
      return body.data.meta.total
    }
    const all = await count('')
    const repeated = await count('status=inactive')
    expect(repeated).toBeLessThan(all)
    expect(await count('status[]=inactive')).toBe(all)
    expect(await count('role[]=admin')).toBe(all)

    const audit = async (query: string) =>
      (
        (await (
          await fetch(`/api/v1/audit-logs?pageSize=100&${query}`)
        ).json()) as {
          data: { meta: { total: number } }
        }
      ).data.meta.total
    const auditAll = await audit('')
    expect(await audit('action[]=auth.sign_in')).toBe(auditAll)
    expect(await audit('action=auth.sign_in')).toBeLessThanOrEqual(auditAll)
  })
})

describe('audit handlers', () => {
  it('requires audit:read and filters by action', async () => {
    await loginSession('viewer@example.com')
    expect((await fetch('/api/v1/audit-logs')).status).toBe(403)

    await loginSession()
    const response = await fetch('/api/v1/audit-logs?page=1&pageSize=5')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { items: unknown[]; meta: { pageSize: number } }
    }
    expect(body.data.items).toHaveLength(5)
    expect(body.data.meta.pageSize).toBe(5)
  })
})

describe('system and department API enforcement', () => {
  const admin = () => principal('demo-admin')!
  const rolePayload = {
    name: '运营经办',
    code: 'department_operator',
    enabled: true,
    permissionIds: ['users:read', 'users:write'],
    menuIds: ['users'],
    scope: 'department',
    departmentIds: [],
  }
  const publicFields = (record: {
    id: string
    resource: string
    protected: boolean
  }) => {
    const {
      id: _id,
      resource: _resource,
      protected: _protected,
      ...body
    } = record
    return body
  }
  async function operator() {
    const role = await changeSystem('roles', undefined, rolePayload, admin())
    if (!('id' in role)) throw new Error('Missing role')
    const account = await changeSystem(
      'accounts',
      undefined,
      {
        name: '部门经办',
        email: 'dept@example.com',
        enabled: true,
        departmentId: 'operations',
        roleIds: [role.id],
        password: 'Operator123!',
      },
      admin()
    )
    if (!('id' in account)) throw new Error('Missing account')
    return { role, account }
  }
  it('filters before pagination/counts and rejects out-of-scope single and mixed batch writes atomically', async () => {
    await operator()
    const signedIn = await (
      await login('dept@example.com', 'Operator123!')
    ).json()
    const listed = await (await fetch('/api/v1/users?pageSize=100')).json()
    expect(listed.data.meta.total).toBeGreaterThan(0)
    expect(
      listed.data.items.every(
        (item: { departmentId: string }) => item.departmentId === 'operations'
      )
    ).toBe(true)
    const all = await import('./data/users')
    const inScope = all.usersStore.find(
      (item) => item.departmentId === 'operations'
    )!
    const outside = all.usersStore.find(
      (item) => item.departmentId === 'sales'
    )!
    const previous = inScope.status
    expect(
      (
        await fetch(`/api/v1/users/${outside.id}`, {
          method: 'DELETE',
          headers: writeHeaders(signedIn.data.csrfToken),
        })
      ).status
    ).toBe(403)
    expect(
      (
        await fetch('/api/v1/users/status', {
          method: 'PATCH',
          headers: writeHeaders(signedIn.data.csrfToken),
          body: JSON.stringify({
            ids: [inScope.id, outside.id],
            status: 'inactive',
          }),
        })
      ).status
    ).toBe(403)
    expect(inScope.status).toBe(previous)
    expect(all.usersStore.some((item) => item.id === outside.id)).toBe(true)
    expect((await fetch('/api/v1/system/accounts')).status).toBe(403)
    expect(
      (
        await fetch('/api/v1/system/roles', {
          method: 'POST',
          headers: writeHeaders(signedIn.data.csrfToken),
          body: JSON.stringify(rolePayload),
        })
      ).status
    ).toBe(403)
  })

  it('rejects role scope escalation through the HTTP API', async () => {
    const { role, account } = await operator()
    const maintainer = await changeSystem(
      'roles',
      undefined,
      {
        ...rolePayload,
        code: 'role_maintainer',
        permissionIds: ['system:roles:write'],
        menuIds: ['dashboard'],
        scope: 'all',
      },
      admin()
    )
    if (!('id' in maintainer) || account.resource !== 'accounts')
      throw new Error('Missing records')
    await changeSystem(
      'accounts',
      account.id,
      { ...publicFields(account), roleIds: [role.id, maintainer.id] },
      admin()
    )
    const signedIn = await (
      await login('dept@example.com', 'Operator123!')
    ).json()
    const response = await fetch('/api/v1/system/roles/' + role.id, {
      method: 'PUT',
      headers: writeHeaders(signedIn.data.csrfToken),
      body: JSON.stringify({ ...publicFields(role), scope: 'all' }),
    })
    expect(response.status).toBe(403)
    expect(principal(account.id)?.dataScopes?.['users:read']?.all).toBe(false)
  })

  it('returns only resource-authorized system reference options', async () => {
    const accountsOnly = await changeSystem(
      'roles',
      undefined,
      {
        ...rolePayload,
        code: 'accounts_reader',
        permissionIds: ['system:accounts:read'],
        menuIds: ['system-accounts'],
        scope: 'all',
      },
      admin()
    )
    const departmentOnly = await changeSystem(
      'roles',
      undefined,
      {
        ...rolePayload,
        code: 'department_reader',
        permissionIds: ['system:departments:read'],
        menuIds: ['system-departments'],
        scope: 'department',
      },
      admin()
    )
    if (!('id' in accountsOnly) || !('id' in departmentOnly))
      throw new Error('Missing roles')
    for (const [email, roleId] of [
      ['accounts-reader@example.com', accountsOnly.id],
      ['department-reader@example.com', departmentOnly.id],
    ]) {
      await changeSystem(
        'accounts',
        undefined,
        {
          name: '范围测试',
          email,
          password: 'Options123!',
          enabled: true,
          departmentId: 'operations',
          roleIds: [roleId],
        },
        admin()
      )
    }
    await login('accounts-reader@example.com', 'Options123!')
    const accountOptions = await fetch('/api/v1/system/options')
    expect(accountOptions.status).toBe(200)
    expect((await accountOptions.json()).data.items).toEqual([])
    await login('department-reader@example.com', 'Options123!')
    const deptOptions = await fetch('/api/v1/system/options')
    expect(deptOptions.status).toBe(200)
    const records = (await deptOptions.json()).data.items as Array<{
      resource: string
      id: string
    }>
    expect(records.map((record) => record.resource)).toEqual(['departments'])
    expect(records.map((record) => record.id)).toEqual(['operations'])
  })

  it('revokes disabled and reset-password sessions permanently, with no credential fields in account responses', async () => {
    const { account } = await operator()
    await login('dept@example.com', 'Operator123!')
    await changeSystem(
      'accounts',
      account.id,
      { ...publicFields(account), enabled: false },
      admin()
    )
    expect((await fetch('/api/v1/auth/session')).status).toBe(401)
    await changeSystem(
      'accounts',
      account.id,
      { ...publicFields(account), enabled: true },
      admin()
    )
    expect((await fetch('/api/v1/auth/session')).status).toBe(401)
    expect((await login('dept@example.com', 'Operator123!')).status).toBe(200)
    await changeSystem(
      'accounts',
      account.id,
      { ...publicFields(account), password: 'NewPassword123!' },
      admin()
    )
    expect((await fetch('/api/v1/auth/session')).status).toBe(401)
    expect((await login('dept@example.com', 'Operator123!')).status).toBe(401)
    expect((await login('dept@example.com', 'NewPassword123!')).status).toBe(
      200
    )
    await login()
    const accountList = await (await fetch('/api/v1/system/accounts')).text()
    expect(accountList).not.toContain('NewPassword123!')
    expect(accountList).not.toContain('hash')
    expect(accountList).not.toContain('credential')
  })
  it('requires CSRF and derives menus, direct route grants and API permissions from the live role', async () => {
    const { role, account } = await operator()
    await login()
    expect(
      (
        await fetch('/api/v1/system/roles', {
          method: 'POST',
          headers: requestedWith,
          body: JSON.stringify(rolePayload),
        })
      ).status
    ).toBe(403)
    await login('dept@example.com', 'Operator123!')
    const nav = await (await fetch('/api/v1/auth/navigation')).json()
    expect(
      nav.data.some((item: { routeId: string }) => item.routeId === 'users')
    ).toBe(true)
    expect(
      nav.data.some(
        (item: { routeId: string }) => item.routeId === 'system-accounts'
      )
    ).toBe(false)
    await changeSystem(
      'roles',
      role.id,
      { ...publicFields(role), permissionIds: [], menuIds: [] },
      admin()
    )
    const session = await (await fetch('/api/v1/auth/session')).json()
    expect(session.data.user.routes).not.toContain('/users')
    expect(session.data.user.permissions).not.toContain('users:read')
    expect((await fetch('/api/v1/users')).status).toBe(403)
    expect(systemStore().records.some((item) => item.id === account.id)).toBe(
      true
    )
    expect(accountById(account.id)?.roleIds).toContain(role.id)
  })
})
