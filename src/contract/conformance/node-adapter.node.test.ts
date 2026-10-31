// Runs under `node --test` (Node ≥ 22.18), not Vitest: `pnpm test:conformance`.
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { CookieJar, createNodeClient } from './node-adapter.ts'
import { type Fixtures, runScenarios, scenarios } from './scenarios.ts'

/**
 * A minimal stand-in back end with just enough of Tier 1 for the first
 * scenario. The full stand-in server and its broken variants are M2-T6.
 */
type Variant = 'correct' | 'session-ignores-cookie'

const fixtures: Fixtures = {
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

function startServer(
  variant: Variant
): Promise<{ server: Server; url: string }> {
  const sessions = new Map<string, string>()
  const server = createServer(async (request, response) => {
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
      const account = Object.values(fixtures).find(
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
    if (request.method === 'GET' && request.url === '/api/v1/auth/session') {
      const email =
        variant === 'session-ignores-cookie'
          ? undefined
          : sid && sessions.get(sid)
      if (!email) return error(401, 'UNAUTHENTICATED')
      return send(200, { data: session(email) })
    }
    error(404, 'NOT_FOUND')
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}` })
    })
  })
}

const loginScenario = scenarios.filter((s) => s.name.startsWith('login:'))
const tier1 = scenarios.filter((s) => s.tier === 1)

describe('Node adapter against a stand-in back end', () => {
  let correct: { server: Server; url: string }
  let broken: { server: Server; url: string }
  before(async () => {
    correct = await startServer('correct')
    broken = await startServer('session-ignores-cookie')
  })
  after(() => {
    correct.server.close()
    broken.server.close()
  })

  it('passes the login scenario: cookie and csrfToken are kept between calls', async () => {
    const results = await runScenarios(
      loginScenario,
      () => createNodeClient(correct.url),
      fixtures
    )
    assert.equal(loginScenario.length, 1)
    assert.deepEqual(
      results.map((r) => [r.name, r.ok, r.error]),
      [[loginScenario[0].name, true, undefined]]
    )
  })

  it('passes every Tier 1 scenario so far, each starting signed out', async () => {
    const results = await runScenarios(
      tier1,
      () => createNodeClient(correct.url),
      fixtures
    )
    assert.ok(results.length >= 2)
    assert.deepEqual(
      results.filter((r) => !r.ok),
      []
    )
  })

  it('reports a failure when the session cookie is not honoured', async () => {
    const [result] = await runScenarios(
      loginScenario,
      () => createNodeClient(broken.url),
      fixtures
    )
    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /getSession .* 401/)
  })
})

describe('CookieJar', () => {
  const response = (...cookies: string[]) => {
    const headers = new Headers()
    for (const cookie of cookies) headers.append('Set-Cookie', cookie)
    return new Response(null, { headers })
  }

  it('keeps name=value pairs and sends them back as one header', () => {
    const jar = new CookieJar()
    jar.store(response('a=1; Path=/; HttpOnly', 'b=2; SameSite=Lax'))
    assert.equal(jar.header(), 'a=1; b=2')
  })

  it('drops cookies cleared with Max-Age=0, a past Expires or an empty value', () => {
    const jar = new CookieJar()
    jar.store(response('a=1', 'b=2', 'c=3'))
    jar.store(
      response(
        'a=; Max-Age=0',
        'b=2; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'c='
      )
    )
    assert.equal(jar.header(), undefined)
  })

  it('gives Max-Age precedence over Expires', () => {
    const jar = new CookieJar()
    jar.store(
      response('a=1; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    )
    assert.equal(jar.header(), 'a=1')
    jar.store(response('a=1; Max-Age=0; Expires=Fri, 01 Jan 2100 00:00:00 GMT'))
    assert.equal(jar.header(), undefined)
  })
})
