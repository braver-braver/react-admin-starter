// Runs under `node --test` (Node ≥ 22.18), not Vitest: `pnpm test:conformance`.
import assert from 'node:assert/strict'
import { type Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { CookieJar, createNodeClient } from './node-adapter.ts'
import { runScenarios, scenarios } from './scenarios.ts'
import {
  standInFixtures as fixtures,
  startStandIn as startServer,
} from './stand-in.node.ts'

const loginScenario = scenarios.filter((s) =>
  s.name.startsWith('login: valid credentials')
)
// The stand-in passes all of Tier 1 (stand-in.node.test.ts); these tests only
// need the auth scenarios to exercise the adapter's cookies and CSRF token.
const authScenarios = scenarios.filter((s) =>
  /^(login|getSession|logout): /.test(s.name)
)

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

  it('passes the login, session and logout scenarios, each starting signed out', async () => {
    const results = await runScenarios(
      authScenarios,
      () => createNodeClient(correct.url),
      fixtures
    )
    assert.ok(results.length >= 4)
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
