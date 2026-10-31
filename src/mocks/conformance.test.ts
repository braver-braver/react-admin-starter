import { createBrowserClient } from '@/contract/conformance/browser-adapter'
import {
  type Fixtures,
  runScenarios,
  scenarios,
} from '@/contract/conformance/scenarios'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { worker } from './browser'
import {
  contractViolations,
  resetContractGuard,
  settleContractChecks,
} from './contract-guard'
import { resetMockSessions } from './handlers'
import { DEMO_PASSWORD } from './handlers/auth'

/** M2-T1: the conformance scenarios run on the mock through the browser adapter. */
const fixtures: Fixtures = {
  admin: { email: 'admin@example.com', password: DEMO_PASSWORD },
  viewer: { email: 'viewer@example.com', password: DEMO_PASSWORD },
  guest: { email: 'guest@example.com', password: DEMO_PASSWORD },
}

beforeAll(async () => {
  await worker.start({ quiet: true })
  resetMockSessions()
})

afterAll(async () => {
  resetMockSessions()
  await worker.stop()
})

describe('conformance scenarios on the mock (browser adapter)', () => {
  it('passes every scenario, and the mock stays within the contract', async () => {
    const results = await runScenarios(
      scenarios,
      () => createBrowserClient(),
      fixtures
    )
    await settleContractChecks()
    const violations = [...contractViolations]
    resetContractGuard()
    expect(results.filter((result) => !result.ok)).toEqual([])
    expect(results.length).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})
