import { createBrowserClient } from '@/contract/conformance/browser-adapter'
import {
  type Fixtures,
  runScenarios,
  scenarios,
} from '@/contract/conformance/scenarios'
import { HttpResponse, http } from 'msw'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { worker } from './browser'
import {
  contractViolations,
  resetContractGuard,
  settleContractChecks,
} from './contract-guard'
import { resetMockSessions } from './handlers'
import { apiBase, DEMO_PASSWORD } from './handlers/auth'

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
      () => createBrowserClient({ resetSession: resetMockSessions }),
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

describe('the suite catches a non-conformant back end', () => {
  it('fails the generic FORBIDDEN scenario when an endpoint skips its capability check', async () => {
    const empty = {
      items: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPageCount: 1 },
    }
    // A broken endpoint: audit logs for anyone, signed in or not.
    worker.use(
      http.get(`${apiBase}/audit-logs`, () =>
        HttpResponse.json({ data: empty })
      )
    )
    try {
      const target = scenarios.filter((s) =>
        s.name.startsWith('generic: listAuditLogs ')
      )
      const results = await runScenarios(
        target,
        () => createBrowserClient({ resetSession: resetMockSessions }),
        fixtures
      )
      expect(
        results
          .filter((r) => !r.ok)
          .map((r) => r.name)
          .sort()
      ).toEqual([
        'generic: listAuditLogs as guest (no capability) → 403 FORBIDDEN',
        'generic: listAuditLogs without a session → 401 UNAUTHENTICATED',
      ])
    } finally {
      worker.resetHandlers()
      await settleContractChecks()
      resetContractGuard()
    }
  })
})
