import { type Operation, operations } from '../operations.ts'
import { type ContractClient } from './client.ts'
import { genericScenarios } from './generic.ts'
import { tier1Scenarios } from './tier1.ts'

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

/**
 * Runs scenarios one by one, each with a fresh, signed-out client: the client
 * is created and `forget()` is called before the scenario starts.
 */
export async function runScenarios(
  list: readonly Scenario[],
  newClient: () => ContractClient,
  fixtures: Fixtures
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []
  for (const scenario of list) {
    try {
      const client = newClient()
      await client.forget()
      await scenario.run(client, fixtures)
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

for (const scenario of tier1Scenarios()) defineScenario(scenario)

// ------------------------------------------------------- derived (Tier 1)

for (const scenario of genericScenarios(operations as readonly Operation[])) {
  defineScenario(scenario)
}
