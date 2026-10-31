import { assert, expectSuccess } from './assert.ts'
import { type ContractClient } from './client.ts'

/**
 * Conformance scenarios: written once, run against the mock (browser adapter)
 * and against any real back end (Node adapter). They use only the
 * `ContractClient` and throw `ContractAssertionError` on failure.
 *
 * Tier 1 is what every back end must pass; Tier 2 covers the full
 * authorization model and needs extra fixtures (see M2-T3).
 */

export type Credentials = { email: string; password: string }

/** Accounts the back end under test must provide. */
export type Fixtures = {
  admin: Credentials
  viewer: Credentials
  guest: Credentials
}

export type Scenario = {
  /** Includes the operation id or AGENTS.md rule it checks. */
  name: string
  tier: 1 | 2
  run(client: ContractClient, fixtures: Fixtures): Promise<void>
}

export const scenarios: Scenario[] = []

export function defineScenario(scenario: Scenario): Scenario {
  if (scenarios.some((existing) => existing.name === scenario.name)) {
    throw new Error(`Duplicate scenario name: ${scenario.name}`)
  }
  scenarios.push(scenario)
  return scenario
}

export type ScenarioResult = {
  name: string
  tier: 1 | 2
  ok: boolean
  error?: string
}

/** Runs scenarios one by one, each with a fresh client. */
export async function runScenarios(
  list: readonly Scenario[],
  newClient: () => ContractClient,
  fixtures: Fixtures
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []
  for (const scenario of list) {
    try {
      await scenario.run(newClient(), fixtures)
      results.push({ name: scenario.name, tier: scenario.tier, ok: true })
    } catch (error) {
      results.push({
        name: scenario.name,
        tier: scenario.tier,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

// ------------------------------------------------------------------ Tier 1

defineScenario({
  name: 'login: valid credentials return a Session that getSession restores',
  tier: 1,
  async run(client, { admin }) {
    const login = expectSuccess(
      await client.call('login', { body: admin }),
      'login'
    )
    assert(
      login.user.email.toLowerCase() === admin.email.toLowerCase(),
      'login: the Session belongs to the signed-in account'
    )
    assert(login.csrfToken, 'login: the Session carries a csrfToken')
    const session = expectSuccess(await client.call('getSession'), 'getSession')
    assert(
      session.user.id === login.user.id,
      'getSession: the cookie restores the same account'
    )
  },
})
