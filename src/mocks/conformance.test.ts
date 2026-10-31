import { createBrowserClient } from '@/contract/conformance/browser-adapter'
import {
  type Fixtures,
  runScenarios,
  type Scenario,
  scenarios,
} from '@/contract/conformance/scenarios'
import { HttpResponse, http } from 'msw'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getCookie } from '@/lib/cookies'
import { worker } from './browser'
import {
  contractViolations,
  resetContractGuard,
  settleContractChecks,
} from './contract-guard'
import { systemStore } from './data/system'
import { usersStore } from './data/users'
import { resetMockSessions } from './handlers'
import {
  apiBase,
  COOKIE_NAME,
  DEMO_PASSWORD,
  mockBase,
  mockSessionSetCookie,
} from './handlers/auth'

const fixtures: Fixtures = {
  admin: { email: 'admin@example.com', password: DEMO_PASSWORD },
  viewer: { email: 'viewer@example.com', password: DEMO_PASSWORD },
  guest: { email: 'guest@example.com', password: DEMO_PASSWORD },
}

/**
 * Lets scenarios save and replay the mock session cookie. MSW keeps its own
 * copy of mocked cookies, which wins over `document.cookie`, so the cookie is
 * put back through a mocked response (outside the API, so the contract guard
 * ignores it) that updates both.
 */
const cookieRoute = `${mockBase}__conformance/session-cookie`
const cookieHandler = http.post(cookieRoute, async ({ request }) => {
  const saved = await request.text()
  return new HttpResponse(null, {
    status: 204,
    headers: { 'Set-Cookie': mockSessionSetCookie(saved || undefined) },
  })
})
const sessionCookies = {
  save: () => getCookie(COOKIE_NAME),
  async restore(saved: string | undefined) {
    await fetch(cookieRoute, { method: 'POST', body: saved ?? '' })
  },
}

beforeAll(async () => {
  await worker.start({ quiet: true })
  resetMockSessions()
})

afterAll(async () => {
  resetMockSessions()
  await worker.stop()
})

const newClient = () =>
  createBrowserClient({ resetSession: resetMockSessions, sessionCookies })

/**
 * Records as JSON with sorted keys and sorted id lists: neither field order
 * nor list order is data (the mock rebuilds the admin role's menu ids in
 * record order, and an edited record moves to the end).
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`
  return JSON.stringify(value)
}

/** The mock data scenarios may touch, audit entries aside. */
function mockData() {
  const db = systemStore()
  return {
    records: db.records.map(canonical).sort(),
    credentials: Object.entries(db.credentials)
      .map(([id, credential]) => `${id}@${credential.version}`)
      .sort(),
    users: usersStore.map(canonical).sort(),
  }
}

const derived = (s: Scenario) => s.name.startsWith('generic: ')
const groups: [string, Scenario[]][] = [
  ['Tier 1', scenarios.filter((s) => s.tier === 1 && !derived(s))],
  ['Tier 2', scenarios.filter((s) => s.tier === 2)],
  ['derived access checks (Tier 1)', scenarios.filter(derived)],
]

/**
 * M2-T4: the Mock runner. Every registered scenario is one test, run in
 * order with a fresh, signed-out client (as `runScenarios` does), while the
 * contract guard checks each mocked response; a violation fails the scenario
 * that caused it.
 */
describe('conformance scenarios on the mock (browser adapter)', () => {
  let before: ReturnType<typeof mockData>
  beforeAll(() => {
    worker.use(cookieHandler)
    before = mockData()
  })
  afterAll(() => {
    worker.resetHandlers()
  })

  it('runs every registered scenario, in Tier 1, Tier 2 and derived groups', () => {
    expect(groups.flatMap(([, list]) => list)).toHaveLength(scenarios.length)
    for (const [label, list] of groups)
      expect(list.length, label).toBeGreaterThan(0)
  })

  for (const [label, list] of groups) {
    describe(label, () => {
      for (const scenario of list) {
        it(scenario.name, async () => {
          resetContractGuard()
          const client = newClient()
          await client.forget()
          try {
            await scenario.run(client, fixtures)
          } finally {
            await settleContractChecks()
          }
          expect(contractViolations).toEqual([])
        })
      }
    })
  }

  it('leaves the mock data as it found it (the scenarios clean up)', () => {
    expect(mockData()).toEqual(before)
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

  it('fails the Tier 2 scenario of each authorization rule a back end breaks', async () => {
    worker.use(
      cookieHandler,
      // Deletes whatever it is asked to, ignoring the data scope.
      http.post(`${apiBase}/users/batch-delete`, async ({ request }) => {
        const { ids } = (await request.json()) as { ids: string[] }
        let deletedCount = 0
        for (let index = usersStore.length - 1; index >= 0; index--) {
          if (ids.includes(usersStore[index].id)) {
            usersStore.splice(index, 1)
            deletedCount++
          }
        }
        return HttpResponse.json({ data: { deletedCount } })
      }),
      // Offers every reference record, whatever the actor may read.
      http.get(`${apiBase}/system/options`, () =>
        HttpResponse.json({
          data: {
            items: systemStore().records.filter(
              (record) => record.resource !== 'accounts'
            ),
          },
        })
      ),
      // Accepts any role edit without checking what it delegates.
      http.put(`${apiBase}/system/roles/:id`, async ({ request, params }) =>
        HttpResponse.json({
          data: {
            ...((await request.json()) as object),
            id: params.id,
            protected: false,
            resource: 'roles',
          },
        })
      ),
      // Accepts any department edit without checking the hierarchy or grants.
      http.put(
        `${apiBase}/system/departments/:id`,
        async ({ request, params }) =>
          HttpResponse.json({
            data: {
              ...((await request.json()) as object),
              id: params.id,
              protected: false,
              resource: 'departments',
            },
          })
      )
    )
    try {
      const results = await runScenarios(
        scenarios.filter((s) => s.tier === 2),
        newClient,
        fixtures
      )
      expect(
        results
          .filter((r) => !r.ok)
          .map((r) => r.name.replace(/ \(.*$/, ''))
          .sort()
      ).toEqual([
        'AGENTS.md: references acyclic',
        'AGENTS.md: reject mixed-scope batches atomically',
        "AGENTS.md: reparenting or enabling a department is checked against the editor's pre-change grants: capabilities and routes of reactivated accounts",
        "AGENTS.md: reparenting or enabling a department is checked against the editor's pre-change grants: data scopes",
        'AGENTS.md: role edits must not delegate capabilities, data scopes or routes beyond the actor, also through existing assignees',
        'AGENTS.md: system reference options follow resource read grants',
      ])
    } finally {
      worker.resetHandlers()
      await settleContractChecks()
      resetContractGuard()
    }
  })
})
