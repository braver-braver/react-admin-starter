// Test double for the conformance self-test: loaded by `node --test` files only
// (Node ≥ 22.18), never by Vitest, the app or any build. It is NOT a reference
// back end and must not be described as one: it exists to prove that the
// runner reports failures (M2-T6, #41).
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { type auditActionValues } from '../audit.ts'
import { API_PREFIX } from '../common.ts'
import { type Operation, operations } from '../operations.ts'
import type { Permission } from '../permissions.ts'
import { userWriteSchema } from '../users.ts'
import type { Fixtures } from './scenarios.ts'

/**
 * `correct` implements what Tier 1 needs: the auth and user operations,
 * uploads and audit logs, plus the generic access checks for every registered
 * operation. Operations without a handler answer 404 once the checks pass.
 *
 * The other variants each break one rule on purpose; the self-test asserts
 * the suite catches every one of them.
 */
type StandInVariant =
  | 'correct'
  /** Requests without a session are served as the admin. */
  | 'no-session-check'
  /** Writes go through without a valid X-CSRF-Token. */
  | 'no-csrf-check'
  /** A duplicate user gets an error code createUser does not declare. */
  | 'undeclared-error-code'
  /** Success bodies come without the `{ data }` envelope. */
  | 'no-data-envelope'
  /** Logout clears the cookie but keeps the session alive on the server. */
  | 'session-survives-logout'
  /** getSession ignores the cookie (always 401). */
  | 'session-ignores-cookie'
  /** Answers getSession only after 1 s, to exercise the runner's timeout. */
  | 'slow-session'

export const standInFixtures: Fixtures = {
  admin: { email: 'admin@example.test', password: 'Secret123!' },
  viewer: { email: 'viewer@example.test', password: 'Secret123!' },
  guest: { email: 'guest@example.test', password: 'Secret123!' },
}

const ALL_PERMISSIONS: Permission[] = [
  'users:read',
  'users:write',
  'permissions:read',
  'audit:read',
  ...(['accounts', 'roles', 'permissions', 'menus', 'departments'] as const)
    .flatMap((resource) => [`${resource}:read`, `${resource}:write`])
    .map((code) => `system:${code}` as Permission),
]
const accounts = [
  { key: 'admin', name: '管理员', permissions: ALL_PERMISSIONS },
  {
    key: 'viewer',
    name: '只读用户',
    permissions: ['users:read', 'permissions:read'] as Permission[],
  },
  { key: 'guest', name: '访客', permissions: [] as Permission[] },
].map((account) => ({
  ...account,
  id: `account-${account.key}`,
  ...standInFixtures[account.key as keyof Fixtures],
}))
type Account = (typeof accounts)[number]

type StoredUser = {
  id: string
  createdBy: string
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  role: string
  status: string
  departmentId?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
type AuditEntry = {
  id: string
  createdAt: string
  actorName: string
  actorEmail: string
  action: (typeof auditActionValues)[number]
  target: string
  detail: string
  ip: string
}

/**
 * What the slow variant observed: requests the client gave up on, and
 * requests that arrived while a slow one was still pending.
 */
type StandInStats = { abandoned: number; overlapped: number }

// Plain fields: Node's type stripping does not support parameter properties.
class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

const SORT_KEYS = new Set([
  'username',
  'fullName',
  'email',
  'phoneNumber',
  'status',
  'role',
  'createdAt',
])
const MAX_UPLOAD = 2 * 1024 * 1024
const IMAGE_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
]

const routes = (operations as readonly Operation[]).map((op) => ({
  op,
  pattern: new RegExp(
    `^${API_PREFIX}${op.path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}$`
  ),
}))

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

function json(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    return null
  }
}

function ids(body: unknown): string[] {
  const list = (body as { ids?: unknown } | null)?.ids
  return Array.isArray(list)
    ? list.filter((id): id is string => typeof id === 'string')
    : []
}

export function startStandIn(
  variant: StandInVariant = 'correct',
  { port = 0 }: { port?: number } = {}
): Promise<{ server: Server; url: string; stats: StandInStats }> {
  const sessions = new Map<string, { account: Account; csrfToken: string }>()
  const users: StoredUser[] = []
  const audit: AuditEntry[] = []
  const stats: StandInStats = { abandoned: 0, overlapped: 0 }
  let slowPending = 0

  const record = (
    actor: Account,
    action: AuditEntry['action'],
    target: string,
    detail: string
  ) =>
    audit.unshift({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      actorName: actor.name,
      actorEmail: actor.email,
      action,
      target,
      detail,
      ip: '127.0.0.1',
    })
  const sessionBody = (session: { account: Account; csrfToken: string }) => ({
    user: {
      id: session.account.id,
      email: session.account.email,
      name: session.account.name,
      roles: [session.account.key],
      permissions: session.account.permissions,
      // Pages the app may open (the dashboard needs none).
      routes: session.account.permissions.includes('users:read')
        ? ['/users']
        : [],
    },
    csrfToken: session.csrfToken,
  })
  const userFields = (body: unknown) => {
    const parsed = userWriteSchema.safeParse(body)
    if (!parsed.success) throw new HttpError(422, 'INVALID_USER_FIELDS')
    return parsed.data
  }
  const duplicate = () => {
    throw variant === 'undeclared-error-code'
      ? new HttpError(422, 'USER_ALREADY_EXISTS')
      : new HttpError(422, 'DUPLICATE_USER')
  }
  const findUser = (id: string) => {
    const user = users.find((entry) => entry.id === id)
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND')
    return user
  }
  const page = <T>(items: T[], query: URLSearchParams) => {
    const pageNumber = Math.max(1, Math.trunc(Number(query.get('page')) || 1))
    const pageSize = Math.min(
      100,
      Math.max(1, Math.trunc(Number(query.get('pageSize')) || 10))
    )
    return {
      items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
      meta: {
        page: pageNumber,
        pageSize,
        total: items.length,
        totalPageCount: Math.max(1, Math.ceil(items.length / pageSize)),
      },
    }
  }

  type Context = {
    session?: { account: Account; csrfToken: string }
    sid?: string
    params: Record<string, string>
    query: URLSearchParams
    request: IncomingMessage
    body: Buffer
    setCookie(value: string): void
  }
  const handlers: Partial<Record<string, (c: Context) => unknown>> = {
    login({ body, sid, setCookie }) {
      const input = json(body) as { email?: unknown; password?: unknown }
      if (
        typeof input?.email !== 'string' ||
        typeof input.password !== 'string' ||
        !input.email ||
        !input.password
      )
        throw new HttpError(400, 'INVALID_CREDENTIALS_FORMAT')
      const account = accounts.find(
        (entry) =>
          entry.email === input.email?.toString().toLowerCase() &&
          entry.password === input.password
      )
      if (!account) throw new HttpError(401, 'INVALID_CREDENTIALS')
      if (sid) sessions.delete(sid)
      const id = randomUUID()
      const session = { account, csrfToken: randomUUID() }
      sessions.set(id, session)
      setCookie(`sid=${id}; Path=/; HttpOnly; SameSite=Lax`)
      record(account, 'auth.sign_in', account.email, '登录')
      return sessionBody(session)
    },
    getSession: ({ session }) => sessionBody(session!),
    logout({ session, sid, setCookie }) {
      if (variant !== 'session-survives-logout' && sid) sessions.delete(sid)
      setCookie('sid=; Path=/; Max-Age=0')
      record(session!.account, 'auth.sign_out', session!.account.email, '退出')
      return { success: true }
    },
    getPermissions: ({ session }) => ({
      roles: [session!.account.key],
      permissions: session!.account.permissions,
    }),
    getNavigation: () => [],
    listUsers({ query }) {
      const term = (query.get('username') ?? '').toLowerCase()
      const statuses = query.getAll('status')
      const roles = query.getAll('role')
      const sortBy = SORT_KEYS.has(query.get('sortBy') ?? '')
        ? query.get('sortBy')!
        : 'username'
      const direction = query.get('sortOrder') === 'desc' ? -1 : 1
      const value = (user: StoredUser) =>
        sortBy === 'fullName'
          ? `${user.firstName} ${user.lastName}`
          : String(user[sortBy as keyof StoredUser] ?? '')
      const matched = users
        .filter(
          (user) =>
            (!term ||
              [
                user.username,
                user.email,
                `${user.firstName} ${user.lastName}`,
                user.phoneNumber,
              ].some((text) => text.toLowerCase().includes(term))) &&
            (!statuses.length || statuses.includes(user.status)) &&
            (!roles.length || roles.includes(user.role))
        )
        .sort((a, b) => direction * value(a).localeCompare(value(b)))
      return page(matched, query)
    },
    createUser({ session, body }) {
      const fields = userFields(json(body))
      if (
        users.some(
          (user) =>
            user.email === fields.email || user.username === fields.username
        )
      )
        duplicate()
      const now = new Date().toISOString()
      const { password: _password, ...rest } = fields
      const user: StoredUser = {
        ...rest,
        id: randomUUID(),
        createdBy: session!.account.id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      users.unshift(user)
      record(
        session!.account,
        'user.created',
        `${user.username}（${user.email}）`,
        `创建用户 ${user.role}`
      )
      return user
    },
    updateUser({ session, params, body }) {
      const user = findUser(params.id)
      const fields = userFields(json(body))
      if (
        users.some(
          (other) =>
            other.id !== user.id &&
            (other.email === fields.email || other.username === fields.username)
        )
      )
        duplicate()
      const { password: _password, departmentId: _department, ...rest } = fields
      Object.assign(user, rest, { updatedAt: new Date().toISOString() })
      record(session!.account, 'user.updated', user.username, '更新用户')
      return user
    },
    deleteUser({ session, params }) {
      const user = findUser(params.id)
      users.splice(users.indexOf(user), 1)
      record(session!.account, 'user.deleted', user.username, '删除用户')
      return { success: true }
    },
    batchDeleteUsers({ session, body }) {
      const wanted = new Set(ids(json(body)))
      let deletedCount = 0
      for (let index = users.length - 1; index >= 0; index--) {
        if (wanted.has(users[index].id)) {
          users.splice(index, 1)
          deletedCount++
        }
      }
      record(
        session!.account,
        'user.batch_deleted',
        `${deletedCount} 个用户`,
        '批量删除'
      )
      return { deletedCount }
    },
    updateUsersStatus({ session, body }) {
      const input = json(body)
      const status = (input as { status?: unknown } | null)?.status
      if (status !== 'active' && status !== 'inactive')
        throw new HttpError(422, 'INVALID_STATUS')
      const wanted = new Set(ids(input))
      let updatedCount = 0
      for (const user of users) {
        if (!wanted.has(user.id)) continue
        user.status = status
        user.updatedAt = new Date().toISOString()
        updatedCount++
      }
      record(
        session!.account,
        'user.status_changed',
        `${updatedCount} 个用户`,
        `状态改为 ${status}`
      )
      return { updatedCount }
    },
    async uploadFile({ request, body }) {
      const form = await new Request('http://stand-in/upload', {
        method: 'POST',
        headers: { 'Content-Type': request.headers['content-type'] ?? '' },
        body: new Uint8Array(body),
      })
        .formData()
        .catch(() => undefined)
      const file = form?.get('file')
      if (!(file instanceof File)) throw new HttpError(422, 'FILE_REQUIRED')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const image = IMAGE_SIGNATURES.some((signature) =>
        signature.every((byte, index) => bytes[index] === byte)
      )
      if (!file.type.startsWith('image/') || !image)
        throw new HttpError(422, 'UNSUPPORTED_FILE_TYPE')
      if (bytes.length > MAX_UPLOAD) throw new HttpError(422, 'FILE_TOO_LARGE')
      const id = randomUUID()
      return {
        id,
        name: file.name,
        url: `/uploads/${id}`,
        contentType: file.type,
        size: bytes.length,
      }
    },
    listAuditLogs({ query }) {
      const actions = query.getAll('action')
      return page(
        audit.filter(
          (entry) => !actions.length || actions.includes(entry.action)
        ),
        query
      )
    },
  }

  const server = createServer(async (request, response) => {
    if (slowPending) stats.overlapped++
    const cookies: string[] = []
    const send = (status: number, body: unknown) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
      })
      response.end(JSON.stringify(body))
    }
    const url = new URL(request.url ?? '/', 'http://stand-in')
    const method = request.method ?? 'GET'
    const match = routes
      .map(({ op, pattern }) => ({ op, found: pattern.exec(url.pathname) }))
      .find(({ op, found }) => found && op.method === method)
    if (!match)
      return send(404, { error: { code: 'NOT_FOUND', message: '未知接口' } })
    const { op, found } = match

    try {
      const sid = /(?:^|;\s*)sid=([^;]+)/.exec(
        request.headers.cookie ?? ''
      )?.[1]
      let session = sid ? sessions.get(sid) : undefined
      if (variant === 'session-ignores-cookie' && op.id === 'getSession')
        session = undefined
      // Access checks, in the order the contract documents.
      if (
        method !== 'GET' &&
        request.headers['x-requested-with'] !== 'ReactAdminStarter'
      )
        throw new HttpError(403, 'REQUEST_HEADER_REQUIRED')
      if (op.auth === 'session' && !session) {
        if (variant !== 'no-session-check')
          throw new HttpError(401, 'UNAUTHENTICATED')
        session = { account: accounts[0], csrfToken: '' }
      }
      const required =
        typeof op.permission === 'string' ? [op.permission] : op.permission
      if (
        required &&
        !required.some((code) => session!.account.permissions.includes(code))
      )
        throw new HttpError(403, 'FORBIDDEN')
      if (
        op.csrf &&
        variant !== 'no-csrf-check' &&
        variant !== 'no-session-check' &&
        request.headers['x-csrf-token'] !== session!.csrfToken
      )
        throw new HttpError(403, 'INVALID_CSRF_TOKEN')

      const handler = handlers[op.id]
      if (!handler) throw new HttpError(404, 'NOT_FOUND')
      const body = await readBody(request)
      if (variant === 'slow-session' && op.id === 'getSession') {
        slowPending++
        const timer = setTimeout(() => {
          slowPending--
          send(200, { data: sessionBody(session!) })
        }, 1000)
        response.on('close', () => {
          if (response.writableEnded) return
          clearTimeout(timer)
          slowPending--
          stats.abandoned++
        })
        return
      }
      const data = await handler({
        session,
        sid,
        params: { ...found!.groups },
        query: url.searchParams,
        request,
        body,
        setCookie: (value) => void cookies.push(value),
      })
      send(op.success.status, variant === 'no-data-envelope' ? data : { data })
    } catch (error) {
      if (!(error instanceof HttpError)) throw error
      send(error.status, { error: { code: error.code, message: error.code } })
    }
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}`, stats })
    })
  })
}
