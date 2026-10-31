// Runs under `node --test` (Node ≥ 22.18), not Vitest: `pnpm test:conformance`.
// M2-T6: proves the suite can fail. The stand-in passes Tier 1; every broken
// variant must make the named scenarios fail.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createNodeClient } from './node-adapter.ts'
import { runScenarios, scenarios } from './scenarios.ts'
import { standInFixtures, startStandIn } from './stand-in.node.ts'

const tier1 = scenarios.filter((s) => s.tier === 1)
const named = (pattern: RegExp) => {
  const list = tier1.filter((s) => pattern.test(s.name)).map((s) => s.name)
  assert.ok(list.length, `no Tier 1 scenario matches ${pattern}`)
  return list
}

async function failuresOn(variant: Parameters<typeof startStandIn>[0]) {
  const { server, url } = await startStandIn(variant)
  try {
    const results = await runScenarios(
      tier1,
      () => createNodeClient(url),
      standInFixtures
    )
    assert.equal(results.length, tier1.length)
    return results.filter((r) => !r.ok)
  } finally {
    server.close()
  }
}

describe('stand-in back end (test double, not a reference implementation)', () => {
  it('passes every Tier 1 scenario, derived access checks included', async () => {
    assert.deepEqual(await failuresOn('correct'), [])
  })

  const broken: [string, Parameters<typeof startStandIn>[0], string[]][] = [
    [
      'serves requests without a session (200 instead of 401)',
      'no-session-check',
      [
        ...named(/^getSession: without a session cookie/),
        ...named(/^generic: .* without a session → 401/),
      ],
    ],
    [
      'lets writes through without X-CSRF-Token',
      'no-csrf-check',
      named(/^generic: .* without X-CSRF-Token → 403/),
    ],
    [
      'answers a duplicate user with an undeclared error code',
      'undeclared-error-code',
      named(/^createUser\/updateUser\/deleteUser: /),
    ],
    [
      'drops the { data } envelope from success bodies',
      'no-data-envelope',
      [
        ...named(/^login: valid credentials/),
        ...named(/^listUsers: /),
        ...named(/^uploadFile: /),
      ],
    ],
    [
      'keeps the session valid after logout',
      'session-survives-logout',
      named(/^logout: /),
    ],
  ]
  for (const [behaviour, variant, expected] of broken) {
    it(`is caught when it ${behaviour} (${variant})`, async () => {
      const failed = await failuresOn(variant)
      const names = new Set(failed.map((r) => r.name))
      const missed = expected.filter((name) => !names.has(name))
      assert.deepEqual(missed, [], `not caught: ${missed.join('; ')}`)
    })
  }

  it('reports the reason of a caught failure', async () => {
    const [envelope] = (await failuresOn('undeclared-error-code')).filter((r) =>
      r.name.startsWith('createUser/')
    )
    assert.match(envelope.error ?? '', /USER_ALREADY_EXISTS|422/)
  })
})
