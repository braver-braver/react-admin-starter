import { describe, expect, it } from 'vitest'
import { type Operation, operations } from '../operations.ts'
import { type ContractClient, type ContractResponse } from './client.ts'
import { type Fixtures } from './scenarios.ts'
import { tier2Scenarios, withFixtures } from './tier2.ts'

const registry: readonly Operation[] = operations
const op = (id: string) => registry.find((o) => o.id === id)!
const account = { email: 'admin@example.test', password: 'secret-1' }
const fixtures: Fixtures = { admin: account, viewer: account, guest: account }

/** Answers login, deletions and batchDeleteUsers; logs every call. */
function fakeClient(failing: string[] = []) {
  const calls: string[] = []
  const client: ContractClient = {
    csrfToken: undefined,
    forget: async () => {},
    async call(id, args = {}): Promise<ContractResponse> {
      const target = args.params?.id
      calls.push(target ? `${id} ${target}` : id)
      const respond = (status: number, body: unknown) => ({
        operation: op(id),
        status,
        headers: new Headers(),
        body,
      })
      if (failing.includes(target ?? id))
        return respond(409, { error: { code: 'SYSTEM_RULE', message: 'no' } })
      if (id === 'login')
        return respond(200, {
          data: {
            user: {
              id: 'a',
              email: account.email,
              name: 'A',
              roles: [],
              permissions: [],
            },
            csrfToken: 'token',
          },
        })
      if (id === 'batchDeleteUsers') {
        const ids = (args.body as { ids: string[] }).ids
        return respond(200, { data: { deletedCount: ids.length } })
      }
      return respond(200, { data: { success: true } })
    },
  }
  return { client, calls }
}

describe('withFixtures cleanup', () => {
  it('signs in as the admin, restores, then deletes users, accounts, roles and departments newest first', async () => {
    const { client, calls } = fakeClient()
    await withFixtures(client, fixtures, async (kit) => {
      kit.track('departments', 'd1')
      kit.track('roles', 'r1')
      kit.track('departments', 'd2')
      kit.track('accounts', 'a1')
      kit.trackUser('u1')
      kit.track('roles', 'r2')
      kit.defer(async () => void calls.push('restore'))
    })
    expect(calls).toEqual([
      'login',
      'restore',
      'batchDeleteUsers',
      'deleteSystemAccount a1',
      'deleteSystemRole r2',
      'deleteSystemRole r1',
      'deleteSystemDepartment d2',
      'deleteSystemDepartment d1',
    ])
  })

  it('makes no calls when nothing was created', async () => {
    const { client, calls } = fakeClient()
    await withFixtures(client, fixtures, async () => {})
    expect(calls).toEqual([])
  })

  it('keeps deleting after a failed deletion and reports every failure', async () => {
    const { client, calls } = fakeClient(['r1'])
    await expect(
      withFixtures(client, fixtures, async (kit) => {
        kit.track('roles', 'r1')
        kit.track('departments', 'd1')
      })
    ).rejects.toThrow(
      /^cleanup: deleteSystemRole .* expected 200, got error SYSTEM_RULE$/
    )
    expect(calls).toContain('deleteSystemDepartment d1')
  })

  it('keeps the scenario failure and adds the cleanup failure to it', async () => {
    const { client } = fakeClient(['d1'])
    await expect(
      withFixtures(client, fixtures, async (kit) => {
        kit.track('departments', 'd1')
        throw new Error('getSystemOptions: only departments')
      })
    ).rejects.toThrow(
      /^getSystemOptions: only departments \(cleanup also failed: deleteSystemDepartment /
    )
  })

  it('stops when the admin cannot sign in, without deleting anything', async () => {
    const { client, calls } = fakeClient(['login'])
    await expect(
      withFixtures(client, fixtures, async (kit) => kit.track('roles', 'r1'))
    ).rejects.toThrow(/^cleanup: login /)
    expect(calls).toEqual(['login'])
  })
})

describe('Tier 2 scenarios', () => {
  it('are named after an AGENTS.md rule and an operation id', () => {
    const ids = new Set(registry.map((o) => o.id))
    for (const scenario of tier2Scenarios()) {
      expect(scenario.tier).toBe(2)
      expect(scenario.name).toMatch(/^AGENTS\.md: /)
      const named = [...scenario.name.matchAll(/\b[a-z]+[A-Z]\w+/g)].map(
        (match) => match[0]
      )
      expect(
        named.some((id) => ids.has(id)),
        scenario.name
      ).toBe(true)
    }
  })
})
