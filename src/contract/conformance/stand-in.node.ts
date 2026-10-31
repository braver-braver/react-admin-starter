// Loaded by `node --test` files and scripts only (Node ≥ 22.18), never by Vitest
// or the app: it uses node:http.
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { Fixtures } from './scenarios.ts'

/**
 * A minimal stand-in back end: login, session and logout only, enough for the
 * auth scenarios of Tier 1. The full stand-in server and its broken variants
 * are M2-T6. `session-ignores-cookie` is a broken variant.
 */
type StandInVariant =
  | 'correct'
  | 'session-ignores-cookie'
  /** Answers getSession only after 1 s, to exercise the runner's timeout. */
  | 'slow-session'

export const standInFixtures: Fixtures = {
  admin: { email: 'admin@example.test', password: 'Secret123!' },
  viewer: { email: 'viewer@example.test', password: 'Secret123!' },
  guest: { email: 'guest@example.test', password: 'Secret123!' },
}

function session(email: string) {
  return {
    user: {
      id: `u-${email}`,
      email,
      name: 'Test',
      roles: ['admin'],
      permissions: [],
    },
    csrfToken: 'csrf-token',
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of request) text += chunk
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * What the slow variant observed: requests the client gave up on, and
 * requests that arrived while a slow one was still pending.
 */
type StandInStats = { abandoned: number; overlapped: number }

export function startStandIn(
  variant: StandInVariant = 'correct'
): Promise<{ server: Server; url: string; stats: StandInStats }> {
  const sessions = new Map<string, string>()
  const stats: StandInStats = { abandoned: 0, overlapped: 0 }
  let slowPending = 0
  const server = createServer(async (request, response) => {
    if (slowPending) stats.overlapped++
    const send = (status: number, body: unknown, headers = {}) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        ...headers,
      })
      response.end(JSON.stringify(body))
    }
    const error = (status: number, code: string) =>
      send(status, { error: { code, message: code } })
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(request.headers.cookie ?? '')?.[1]

    if (request.method === 'POST' && request.url === '/api/v1/auth/login') {
      if (request.headers['x-requested-with'] !== 'ReactAdminStarter')
        return error(403, 'REQUEST_HEADER_REQUIRED')
      const body = (await readJson(request)) as {
        email?: string
        password?: string
      }
      const account = Object.values(standInFixtures).find(
        (a) => a.email === body?.email && a.password === body?.password
      )
      if (!account) return error(401, 'INVALID_CREDENTIALS')
      const id = `s${sessions.size + 1}`
      sessions.set(id, account.email)
      return send(
        200,
        { data: session(account.email) },
        {
          'Set-Cookie': `sid=${id}; Path=/; HttpOnly; SameSite=Lax`,
        }
      )
    }
    if (request.method === 'POST' && request.url === '/api/v1/auth/logout') {
      if (request.headers['x-requested-with'] !== 'ReactAdminStarter')
        return error(403, 'REQUEST_HEADER_REQUIRED')
      if (!sid || !sessions.has(sid)) return error(401, 'UNAUTHENTICATED')
      if (request.headers['x-csrf-token'] !== 'csrf-token')
        return error(403, 'INVALID_CSRF_TOKEN')
      sessions.delete(sid)
      return send(
        200,
        { data: { success: true } },
        {
          'Set-Cookie': 'sid=; Path=/; Max-Age=0',
        }
      )
    }
    if (request.method === 'GET' && request.url === '/api/v1/auth/session') {
      const email =
        variant === 'session-ignores-cookie'
          ? undefined
          : sid && sessions.get(sid)
      if (!email) return error(401, 'UNAUTHENTICATED')
      if (variant === 'slow-session') {
        slowPending++
        const timer = setTimeout(() => {
          slowPending--
          send(200, { data: session(email) })
        }, 1000)
        response.on('close', () => {
          if (response.writableEnded) return
          clearTimeout(timer)
          slowPending--
          stats.abandoned++
        })
        return
      }
      return send(200, { data: session(email) })
    }
    error(404, 'NOT_FOUND')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}`, stats })
    })
  })
}
