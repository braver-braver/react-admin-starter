import type { z } from 'zod'
import type { Permission } from '../permissions.ts'
import type {
  Account,
  departmentSchema,
  Menu,
  permissionSchema,
  Role,
} from '../system.ts'
import {
  assert,
  ContractAssertionError,
  expectError,
  expectSuccess,
} from './assert.ts'
import { type ContractClient } from './client.ts'
import type { Credentials, Fixtures, Scenario } from './scenarios.ts'
import { signIn, unique, userBody } from './tier1.ts'

/**
 * Tier 2: the authorization rules of AGENTS.md ("System authorization …"
 * through "Reparenting …"). Each scenario builds the departments, roles and
 * accounts it needs through the system API as the admin fixture, signs in as
 * those accounts, checks one rule and deletes what it created. A back end
 * therefore needs only the three fixture accounts and a working system API
 * (see docs/conformance-fixtures.md).
 */

type ListItems = {
  listSystemAccounts: Account
  listSystemRoles: Role
  listSystemPermissions: z.output<typeof permissionSchema>
  listSystemMenus: Menu
  listSystemDepartments: z.output<typeof departmentSchema>
}

/** Every record of a system list, following the pages. */
export async function listAll<Id extends keyof ListItems>(
  client: ContractClient,
  id: Id,
  search?: string
): Promise<ListItems[Id][]> {
  const items: ListItems[Id][] = []
  for (let page = 1; ; page++) {
    const data = expectSuccess(
      await client.call(id, {
        query: { page, pageSize: 100, ...(search ? { search } : {}) },
      }),
      id
    ) as { items: ListItems[Id][]; meta: { totalPageCount: number } }
    items.push(...data.items)
    if (page >= data.meta.totalPageCount || !data.items.length) return items
  }
}

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

type Scope = Role['scope']
type DepartmentRecord = ListItems['listSystemDepartments']

const accountBody = (account: Account) => ({
  name: account.name,
  email: account.email,
  enabled: account.enabled,
  departmentId: account.departmentId,
  roleIds: account.roleIds,
})
const departmentBody = (department: DepartmentRecord) => ({
  name: department.name,
  code: department.code,
  parentId: department.parentId,
  enabled: department.enabled,
})

/** Builds and removes the records of one scenario. */
export type FixtureKit = {
  /** Random prefix of every name, code and e-mail the kit creates. */
  readonly prefix: string
  /** Signs in as `account`; the previous session is simply replaced. */
  signIn(account: Credentials): ReturnType<typeof signIn>
  asAdmin(): ReturnType<typeof signIn>
  /** Ids of the permission records with these codes. */
  permissionIds(codes: readonly Permission[]): Promise<string[]>
  /** A top-level department, the parent of the departments the kit creates. */
  topDepartmentId(): Promise<string>
  /** The body of a new role, without creating it. */
  roleBody(input: RoleSpec): Promise<Record<string, unknown>>
  /** The body of a new account, without creating it. */
  accountBody(input: AccountSpec): Record<string, unknown> & {
    email: string
    password: string
  }
  /** These `create*` calls need a session allowed to create the record. */
  department(input?: {
    parentId?: string
    enabled?: boolean
  }): Promise<DepartmentRecord>
  role(input: RoleSpec): Promise<Role>
  account(
    input: AccountSpec
  ): Promise<{ record: Account; credentials: Credentials }>
  /** A business user created by the current session. */
  user(input?: { departmentId?: string }): Promise<{ id: string }>
  /** Deletes, at the end, a record created without the kit. */
  track(resource: 'accounts' | 'roles' | 'departments', id: string): void
  trackUser(id: string): void
  /** Runs at the end as the admin, before anything is deleted. */
  defer(restore: () => Promise<void>): void
}

type RoleSpec = {
  permissions: readonly Permission[]
  scope: Scope
  departmentIds?: readonly string[]
  menuIds?: readonly string[]
}
type AccountSpec = { departmentId: string; roleIds: string[] }

const deleteOperation = {
  accounts: 'deleteSystemAccount',
  roles: 'deleteSystemRole',
  departments: 'deleteSystemDepartment',
} as const
const deleteOrder = ['accounts', 'roles', 'departments'] as const

/**
 * Runs `body` with a kit, then, signed in as the admin fixture: runs the
 * deferred restores, deletes the business users, then accounts, roles and
 * departments (each newest first, so children go before their parents), and
 * checks every deletion. A failing cleanup is reported, but never hides an
 * earlier failure of the scenario itself.
 */
export async function withFixtures(
  client: ContractClient,
  fixtures: Fixtures,
  body: (kit: FixtureKit) => Promise<void>
) {
  const prefix = unique()
  let serial = 0
  const next = () => ++serial
  const created: { resource: (typeof deleteOrder)[number]; id: string }[] = []
  const users: string[] = []
  const deferred: (() => Promise<void>)[] = []
  let topDepartment: string | undefined
  let permissionCache: Map<string, string> | undefined

  const kit: FixtureKit = {
    prefix,
    signIn: (account) => signIn(client, account),
    asAdmin: () => signIn(client, fixtures.admin),
    async permissionIds(codes) {
      permissionCache ??= new Map(
        (await listAll(client, 'listSystemPermissions')).map((record) => [
          record.code,
          record.id,
        ])
      )
      return codes.map((code) => {
        const id = permissionCache!.get(code)
        assert(id, `fixtures: no permission record has the code ${code}`)
        return id
      })
    },
    async topDepartmentId() {
      if (!topDepartment) {
        const top = (await listAll(client, 'listSystemDepartments')).find(
          (record) => !record.parentId && record.enabled
        )
        assert(top, 'fixtures: the admin sees no enabled top-level department')
        topDepartment = top.id
      }
      return topDepartment
    },
    async roleBody({ permissions, scope, departmentIds = [], menuIds = [] }) {
      const n = next()
      return {
        name: `一致性角色 ${prefix} ${n}`,
        code: `${prefix}-r${n}`,
        enabled: true,
        permissionIds: await kit.permissionIds(permissions),
        menuIds,
        scope,
        departmentIds,
      }
    },
    accountBody({ departmentId, roleIds }) {
      const n = next()
      return {
        name: `一致性账号 ${n}`,
        email: `${prefix}.a${n}@example.test`,
        enabled: true,
        departmentId,
        roleIds,
        password: `Ct-${prefix}-${n}!`,
      }
    },
    async department({ parentId, enabled = true } = {}) {
      const n = next()
      const record = expectSuccess(
        await client.call('createSystemDepartment', {
          body: {
            name: `一致性部门 ${prefix} ${n}`,
            code: `${prefix}-d${n}`,
            parentId: parentId ?? (await kit.topDepartmentId()),
            enabled,
          },
        }),
        'createSystemDepartment'
      )
      created.push({ resource: 'departments', id: record.id })
      return record
    },
    async role(input) {
      const record = expectSuccess(
        await client.call('createSystemRole', {
          body: await kit.roleBody(input),
        }),
        'createSystemRole'
      )
      created.push({ resource: 'roles', id: record.id })
      return record
    },
    async account(input) {
      const body = kit.accountBody(input)
      const record = expectSuccess(
        await client.call('createSystemAccount', { body }),
        'createSystemAccount'
      )
      created.push({ resource: 'accounts', id: record.id })
      return {
        record,
        credentials: { email: body.email, password: body.password },
      }
    },
    async user({ departmentId } = {}) {
      const record = expectSuccess(
        await client.call('createUser', {
          body: {
            ...userBody(prefix, `u${next()}`),
            ...(departmentId ? { departmentId } : {}),
          },
        }),
        'createUser'
      )
      users.push(record.id)
      return record
    },
    track: (resource, id) => void created.push({ resource, id }),
    trackUser: (id) => void users.push(id),
    defer: (restore) => void deferred.push(restore),
  }

  let failure: unknown
  try {
    await body(kit)
  } catch (error) {
    failure = error
  }

  const problems: string[] = []
  const attempt = async (step: () => Promise<void>) => {
    try {
      await step()
    } catch (error) {
      problems.push(reason(error))
    }
  }
  if (created.length || users.length || deferred.length) {
    await attempt(async () => void (await kit.asAdmin()))
    if (!problems.length) {
      for (const restore of deferred.reverse()) await attempt(restore)
      if (users.length) {
        await attempt(async () => {
          const removed = expectSuccess(
            await client.call('batchDeleteUsers', { body: { ids: users } }),
            'batchDeleteUsers'
          )
          assert(
            removed.deletedCount === users.length,
            `batchDeleteUsers deleted ${removed.deletedCount} of ${users.length} users`
          )
        })
      }
      for (const resource of deleteOrder) {
        for (const record of created
          .filter((entry) => entry.resource === resource)
          .reverse()) {
          await attempt(async () => {
            expectSuccess(
              await client.call(deleteOperation[resource], {
                params: { id: record.id },
              }),
              deleteOperation[resource]
            )
          })
        }
      }
    }
  }
  if (problems.length) {
    const cleanup = problems.join('; ')
    if (!failure) throw new ContractAssertionError(`cleanup: ${cleanup}`)
    throw new ContractAssertionError(
      `${reason(failure)} (cleanup also failed: ${cleanup})`
    )
  }
  if (failure) throw failure
}

/** Object keys that must never reach an account DTO or an audit entry. */
const CREDENTIAL_KEY = /pass(word)?|hash|salt|secret|credential/i

function findCredential(value: unknown, secrets: string[], at = '$'): string {
  if (typeof value === 'string')
    return secrets.some((secret) => value.includes(secret))
      ? `${at} contains a password`
      : ''
  if (!value || typeof value !== 'object') return ''
  for (const [key, child] of Object.entries(value)) {
    if (!Array.isArray(value) && CREDENTIAL_KEY.test(key))
      return `${at}.${key} is a credential field`
    const found = findCredential(child, secrets, `${at}.${key}`)
    if (found) return found
  }
  return ''
}

function expectNoCredentials(label: string, body: unknown, secrets: string[]) {
  const found = findCredential(body, secrets)
  assert(!found, `${label}: ${found}`)
}

const USERS_ROUTE_ID = 'users'

export function tier2Scenarios(): Scenario[] {
  return [
    {
      name: 'AGENTS.md: never combine read-all with write-self into write-all (listUsers, updateUser → 403 DATA_SCOPE_DENIED)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const department = await kit.department()
          const readAll = await kit.role({
            permissions: ['users:read'],
            scope: 'all',
          })
          const writeSelf = await kit.role({
            permissions: ['users:write'],
            scope: 'self',
          })
          const writer = await kit.account({
            departmentId: department.id,
            roleIds: [readAll.id, writeSelf.id],
          })
          const others = await kit.user()

          await kit.signIn(writer.credentials)
          const own = await kit.user()
          const list = expectSuccess(
            await client.call('listUsers', {
              query: { page: 1, pageSize: 10, username: kit.prefix },
            }),
            'listUsers'
          )
          assert(
            list.meta.total === 2,
            `listUsers: read-all sees both users, got meta.total ${list.meta.total}`
          )
          expectError(
            await client.call('updateUser', {
              params: { id: others.id },
              body: userBody(kit.prefix, 'others'),
            }),
            403,
            'DATA_SCOPE_DENIED'
          )
          expectSuccess(
            await client.call('updateUser', {
              params: { id: own.id },
              body: { ...userBody(kit.prefix, 'own'), firstName: '本人' },
            }),
            'updateUser'
          )
        })
      },
    },
    {
      name: 'AGENTS.md: filter before counts/pagination (listUsers meta.total counts only in-scope users)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const inside = await kit.department()
          const outside = await kit.department()
          const role = await kit.role({
            permissions: ['users:read'],
            scope: 'custom',
            departmentIds: [inside.id],
          })
          const reader = await kit.account({
            departmentId: inside.id,
            roleIds: [role.id],
          })
          const visible = [
            await kit.user({ departmentId: inside.id }),
            await kit.user({ departmentId: inside.id }),
          ].map((user) => user.id)
          for (let i = 0; i < 3; i++)
            await kit.user({ departmentId: outside.id })

          await kit.signIn(reader.credentials)
          const seen: string[] = []
          for (const page of [1, 2]) {
            const data = expectSuccess(
              await client.call('listUsers', {
                query: { page, pageSize: 1, username: kit.prefix },
              }),
              'listUsers'
            )
            assert(
              data.meta.total === 2 && data.meta.totalPageCount === 2,
              `listUsers: 2 of the 5 matching users are in scope, got meta ${JSON.stringify(data.meta)}`
            )
            assert(
              data.items.length === 1,
              `listUsers: page ${page} holds 1 user, got ${data.items.length}`
            )
            seen.push(...data.items.map((user) => user.id))
          }
          assert(
            [...seen].sort().join() === [...visible].sort().join(),
            'listUsers: the pages hold exactly the in-scope users'
          )
        })
      },
    },
    {
      name: 'AGENTS.md: reject mixed-scope batches atomically (batchDeleteUsers, updateUsersStatus → 403 DATA_SCOPE_DENIED, nothing changed)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const inside = await kit.department()
          const outside = await kit.department()
          const role = await kit.role({
            permissions: ['users:read', 'users:write'],
            scope: 'custom',
            departmentIds: [inside.id],
          })
          const writer = await kit.account({
            departmentId: inside.id,
            roleIds: [role.id],
          })
          const mine = await kit.user({ departmentId: inside.id })
          const foreign = await kit.user({ departmentId: outside.id })
          const ids = [mine.id, foreign.id]
          const before = expectSuccess(
            await client.call('listUsers', {
              query: { page: 1, pageSize: 10, username: kit.prefix },
            }),
            'listUsers'
          ).items
          const statusOf = (items: typeof before, id: string) =>
            items.find((user) => user.id === id)?.status

          await kit.signIn(writer.credentials)
          expectError(
            await client.call('batchDeleteUsers', { body: { ids } }),
            403,
            'DATA_SCOPE_DENIED'
          )
          const flipped =
            statusOf(before, mine.id) === 'inactive' ? 'active' : 'inactive'
          expectError(
            await client.call('updateUsersStatus', {
              body: { ids, status: flipped },
            }),
            403,
            'DATA_SCOPE_DENIED'
          )

          await kit.asAdmin()
          const after = expectSuccess(
            await client.call('listUsers', {
              query: { page: 1, pageSize: 10, username: kit.prefix },
            }),
            'listUsers'
          ).items
          for (const id of ids) {
            assert(
              statusOf(after, id) === statusOf(before, id),
              `a rejected batch left user ${id} deleted or changed`
            )
          }

          await kit.signIn(writer.credentials)
          const control = expectSuccess(
            await client.call('updateUsersStatus', {
              body: { ids: [mine.id], status: flipped },
            }),
            'updateUsersStatus'
          )
          assert(
            control.updatedCount === 1,
            `updateUsersStatus: an in-scope batch updates 1 user, got ${control.updatedCount}`
          )
        })
      },
    },
    {
      name: 'AGENTS.md: hidden navigation does not revoke API permission (updateSystemMenu visible=false, getNavigation, listUsers)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const menu = (await listAll(client, 'listSystemMenus')).find(
            (record) =>
              record.kind === 'page' && record.routeId === USERS_ROUTE_ID
          )
          assert(
            menu,
            `listSystemMenus: no page menu for route ${USERS_ROUTE_ID}`
          )
          const { id } = menu
          const update = (visible: boolean) =>
            client.call('updateSystemMenu', {
              params: { id },
              body: {
                name: menu.name,
                parentId: menu.parentId,
                kind: menu.kind,
                routeId: menu.routeId,
                enabled: menu.enabled,
                visible,
                order: menu.order,
              },
            })
          expectSuccess(await update(false), 'updateSystemMenu')
          kit.defer(async () => {
            expectSuccess(await update(menu.visible), 'updateSystemMenu')
          })

          await kit.signIn(fixtures.viewer)
          const navigation = expectSuccess(
            await client.call('getNavigation'),
            'getNavigation'
          )
          assert(
            !navigation.some((item) => item.id === id && item.visible),
            'getNavigation: a hidden menu is not shown as visible navigation'
          )
          expectSuccess(
            await client.call('listUsers', { query: { page: 1, pageSize: 1 } }),
            'listUsers'
          )
        })
      },
    },
    {
      name: 'AGENTS.md: navigation does not grant API permission (a role with the users menu but no users:read: getNavigation, listUsers → 403 FORBIDDEN)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const menu = (await listAll(client, 'listSystemMenus')).find(
            (record) =>
              record.kind === 'page' && record.routeId === USERS_ROUTE_ID
          )
          assert(
            menu,
            `listSystemMenus: no page menu for route ${USERS_ROUTE_ID}`
          )
          const department = await kit.department()
          const role = await kit.role({
            permissions: [],
            scope: 'all',
            menuIds: [menu.id],
          })
          const account = await kit.account({
            departmentId: department.id,
            roleIds: [role.id],
          })

          await kit.signIn(account.credentials)
          const navigation = expectSuccess(
            await client.call('getNavigation'),
            'getNavigation'
          )
          assert(
            !navigation.some((item) => item.routeId === USERS_ROUTE_ID),
            'getNavigation: a page whose capability is missing is not navigation'
          )
          expectError(
            await client.call('listUsers', { query: { page: 1, pageSize: 1 } }),
            403,
            'FORBIDDEN'
          )
        })
      },
    },
    {
      name: 'AGENTS.md: keep bootstrap admin/recovery entries protected (updateSystemAccount, deleteSystemRole → 409 SYSTEM_RULE)',
      tier: 2,
      async run(client, fixtures) {
        const { admin } = fixtures
        await signIn(client, admin)
        const self = (
          await listAll(client, 'listSystemAccounts', admin.email)
        ).find(
          (record) => record.email.toLowerCase() === admin.email.toLowerCase()
        )
        assert(
          self,
          'listSystemAccounts: the admin fixture has no account record'
        )
        assert(
          self.protected,
          'listSystemAccounts: the admin fixture must be the protected bootstrap account'
        )
        expectError(
          await client.call('updateSystemAccount', {
            params: { id: self.id },
            body: { ...accountBody(self), enabled: false },
          }),
          409,
          'SYSTEM_RULE'
        )
        const role = (await listAll(client, 'listSystemRoles')).find(
          (record) => record.protected
        )
        assert(role, 'listSystemRoles: no protected (bootstrap) role')
        expectError(
          await client.call('deleteSystemRole', { params: { id: role.id } }),
          409,
          'SYSTEM_RULE'
        )
        const department = (
          await listAll(client, 'listSystemDepartments')
        ).find((record) => record.protected)
        if (department) {
          expectError(
            await client.call('deleteSystemDepartment', {
              params: { id: department.id },
            }),
            409,
            'SYSTEM_RULE'
          )
        }
        expectSuccess(await client.call('getSession'), 'getSession')
      },
    },
    {
      name: 'AGENTS.md: references acyclic (updateSystemDepartment with itself or a descendant as parent → 422 SYSTEM_RULE)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const parent = await kit.department()
          const child = await kit.department({ parentId: parent.id })
          for (const parentId of [child.id, parent.id]) {
            expectError(
              await client.call('updateSystemDepartment', {
                params: { id: parent.id },
                body: { ...departmentBody(parent), parentId },
              }),
              422,
              'SYSTEM_RULE'
            )
          }
        })
      },
    },
    {
      name: 'AGENTS.md: credentials out of account DTOs/audit (createSystemAccount, updateSystemAccount, listSystemAccounts, login, listAuditLogs)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const department = await kit.department()
          const role = await kit.role({ permissions: [], scope: 'self' })
          const body = kit.accountBody({
            departmentId: department.id,
            roleIds: [role.id],
          })
          const secrets = [body.password, `${body.password}-2`]
          const created = await client.call('createSystemAccount', { body })
          const account = expectSuccess(created, 'createSystemAccount')
          kit.track('accounts', account.id)
          expectNoCredentials('createSystemAccount', created.body, secrets)

          const updated = await client.call('updateSystemAccount', {
            params: { id: account.id },
            body: { ...accountBody(account), password: secrets[1] },
          })
          expectSuccess(updated, 'updateSystemAccount')
          expectNoCredentials('updateSystemAccount', updated.body, secrets)

          const listed = await client.call('listSystemAccounts', {
            query: { page: 1, pageSize: 10, search: body.email },
          })
          assert(
            expectSuccess(listed, 'listSystemAccounts').items.some(
              (item) => item.id === account.id
            ),
            'listSystemAccounts: the search finds the new account'
          )
          expectNoCredentials('listSystemAccounts', listed.body, secrets)

          const audit = await client.call('listAuditLogs', {
            query: { page: 1, pageSize: 100 },
          })
          expectSuccess(audit, 'listAuditLogs')
          expectNoCredentials('listAuditLogs', audit.body, secrets)

          const login = await client.call('login', {
            body: { email: body.email, password: secrets[1] },
          })
          expectSuccess(login, 'login')
          expectNoCredentials('login', login.body, secrets)
        })
      },
    },
    {
      name: 'AGENTS.md: revoked sessions invalid after re-enabling (updateSystemAccount enabled=false then true; the old session gets 401 from getSession)',
      tier: 2,
      async run(client, fixtures) {
        const cookies = client.sessionCookies
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const department = await kit.department()
          const role = await kit.role({ permissions: [], scope: 'self' })
          const { record, credentials } = await kit.account({
            departmentId: department.id,
            roleIds: [role.id],
          })
          const setEnabled = async (enabled: boolean) =>
            expectSuccess(
              await client.call('updateSystemAccount', {
                params: { id: record.id },
                body: { ...accountBody(record), enabled },
              }),
              'updateSystemAccount'
            )
          /** getSession with the saved session, then back to the admin. */
          const replay = async (saved: string | undefined) => {
            const admin = cookies!.save()
            await cookies!.restore(saved)
            const response = await client.call('getSession')
            await cookies!.restore(admin)
            expectSuccess(await client.call('getSession'), 'getSession')
            return response
          }

          await kit.signIn(credentials)
          const saved = cookies?.save()
          // Drop the cookie without signing out, so the session stays alive.
          await cookies?.restore(undefined)
          await kit.asAdmin()
          if (cookies) {
            expectSuccess(await replay(saved), 'getSession')
          }
          await setEnabled(false)
          expectError(
            await client.call('login', { body: credentials }),
            401,
            'INVALID_CREDENTIALS'
          )
          await setEnabled(true)
          if (cookies) {
            expectError(await replay(saved), 401, 'UNAUTHENTICATED')
          }
          await kit.signIn(credentials)
        })
      },
    },
    {
      name: 'AGENTS.md: role edits must not delegate capabilities, data scopes or routes beyond the actor, also through existing assignees (createSystemRole, updateSystemRole → 403 SYSTEM_RULE)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const menu = (await listAll(client, 'listSystemMenus')).find(
            (record) =>
              record.kind === 'page' && record.routeId === USERS_ROUTE_ID
          )
          assert(
            menu,
            `listSystemMenus: no page menu for route ${USERS_ROUTE_ID}`
          )
          const home = await kit.department()
          const elsewhere = await kit.department()
          // The editor may edit any role, but holds users:read only for
          // `home`, no users:write, and not the users menu.
          const editorRoles = [
            await kit.role({
              permissions: ['system:roles:read', 'system:roles:write'],
              scope: 'all',
            }),
            await kit.role({
              permissions: ['users:read'],
              scope: 'custom',
              departmentIds: [home.id],
            }),
          ]
          const editor = await kit.account({
            departmentId: home.id,
            roleIds: editorRoles.map((role) => role.id),
          })
          // A role within the editor's grants, assigned to an account in
          // another department.
          const target = await kit.role({
            permissions: ['users:read'],
            scope: 'custom',
            departmentIds: [home.id],
          })
          await kit.account({
            departmentId: elsewhere.id,
            roleIds: [target.id],
          })
          const targetBody = {
            name: target.name,
            code: target.code,
            enabled: target.enabled,
            permissionIds: target.permissionIds,
            menuIds: target.menuIds,
            scope: target.scope,
            departmentIds: target.departmentIds,
          }
          const [usersWrite] = await kit.permissionIds(['users:write'])
          const createBeyond = [
            [
              'an unheld capability',
              { permissions: ['users:write'], scope: 'all' },
            ],
            [
              'a wider data scope',
              { permissions: ['users:read'], scope: 'all' },
            ],
            [
              'an unheld route',
              {
                permissions: ['users:read'],
                scope: 'custom',
                departmentIds: [home.id],
                menuIds: [menu.id],
              },
            ],
          ] as const
          const creates: [string, Record<string, unknown>][] = []
          for (const [label, spec] of createBeyond)
            creates.push([label, await kit.roleBody(spec)])
          const updates: [string, Record<string, unknown>][] = [
            [
              'an unheld capability',
              {
                ...targetBody,
                permissionIds: [...target.permissionIds, usersWrite],
              },
            ],
            ['a wider data scope', { ...targetBody, scope: 'all' }],
            ['an unheld route', { ...targetBody, menuIds: [menu.id] }],
            // `department` stays within the editor's own grants, but gives
            // the assignee in `elsewhere` users:read there.
            [
              "a scope beyond the editor's for an existing assignee",
              { ...targetBody, scope: 'department', departmentIds: [] },
            ],
          ]

          await kit.signIn(editor.credentials)
          for (const [label, body] of creates) {
            const response = await client.call('createSystemRole', { body })
            if (response.status === 201)
              kit.track(
                'roles',
                (response.body as { data: { id: string } }).data.id
              )
            try {
              expectError(response, 403, 'SYSTEM_RULE')
            } catch (error) {
              throw new ContractAssertionError(
                `createSystemRole with ${label}: ${reason(error)}`
              )
            }
          }
          for (const [label, body] of updates) {
            try {
              expectError(
                await client.call('updateSystemRole', {
                  params: { id: target.id },
                  body,
                }),
                403,
                'SYSTEM_RULE'
              )
            } catch (error) {
              throw new ContractAssertionError(
                `updateSystemRole with ${label}: ${reason(error)}`
              )
            }
          }
          const renamed = expectSuccess(
            await client.call('updateSystemRole', {
              params: { id: target.id },
              body: { ...targetBody, name: `${target.name} 改名` },
            }),
            'updateSystemRole'
          )
          assert(
            renamed.scope === 'custom' &&
              renamed.menuIds.length === 0 &&
              renamed.permissionIds.join() === target.permissionIds.join(),
            'updateSystemRole: rejected edits left the role unchanged'
          )
          const allowed = expectSuccess(
            await client.call('createSystemRole', {
              body: await kit.roleBody({
                permissions: ['users:read'],
                scope: 'custom',
                departmentIds: [home.id],
              }),
            }),
            'createSystemRole'
          )
          kit.track('roles', allowed.id)
        })
      },
    },
    {
      name: 'AGENTS.md: account assignments must not delegate data scopes beyond the actor (createSystemAccount with a wider role → 403 SYSTEM_RULE)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const department = await kit.department()
          const managerRole = await kit.role({
            permissions: [
              'system:accounts:read',
              'system:accounts:write',
              'users:read',
            ],
            scope: 'custom',
            departmentIds: [department.id],
          })
          const manager = await kit.account({
            departmentId: department.id,
            roleIds: [managerRole.id],
          })
          const wide = await kit.role({
            permissions: ['users:read'],
            scope: 'all',
          })
          const narrow = await kit.role({
            permissions: ['users:read'],
            scope: 'custom',
            departmentIds: [department.id],
          })

          await kit.signIn(manager.credentials)
          expectError(
            await client.call('createSystemAccount', {
              body: kit.accountBody({
                departmentId: department.id,
                roleIds: [wide.id],
              }),
            }),
            403,
            'SYSTEM_RULE'
          )
          const allowed = expectSuccess(
            await client.call('createSystemAccount', {
              body: kit.accountBody({
                departmentId: department.id,
                roleIds: [narrow.id],
              }),
            }),
            'createSystemAccount'
          )
          kit.track('accounts', allowed.id)
        })
      },
    },
    {
      name: 'AGENTS.md: self-scoped account edits cannot change departments (updateSystemAccount → 403 SYSTEM_RULE)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const home = await kit.department()
          const elsewhere = await kit.department()
          const role = await kit.role({
            permissions: ['system:accounts:read', 'system:accounts:write'],
            scope: 'self',
          })
          const { record, credentials } = await kit.account({
            departmentId: home.id,
            roleIds: [role.id],
          })

          await kit.signIn(credentials)
          expectError(
            await client.call('updateSystemAccount', {
              params: { id: record.id },
              body: { ...accountBody(record), departmentId: elsewhere.id },
            }),
            403,
            'SYSTEM_RULE'
          )
          expectSuccess(
            await client.call('updateSystemAccount', {
              params: { id: record.id },
              body: { ...accountBody(record), name: `${record.name} 改名` },
            }),
            'updateSystemAccount'
          )
        })
      },
    },
    {
      name: 'AGENTS.md: system reference options follow resource read grants (getSystemOptions)',
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const inside = await kit.department()
          const outside = await kit.department()
          const departmentsRole = await kit.role({
            permissions: ['system:departments:read'],
            scope: 'custom',
            departmentIds: [inside.id],
          })
          const rolesRole = await kit.role({
            permissions: ['system:roles:read'],
            scope: 'all',
          })
          const departmentReader = await kit.account({
            departmentId: inside.id,
            roleIds: [departmentsRole.id],
          })
          const roleReader = await kit.account({
            departmentId: inside.id,
            roleIds: [rolesRole.id],
          })

          await kit.signIn(departmentReader.credentials)
          const departments = expectSuccess(
            await client.call('getSystemOptions'),
            'getSystemOptions'
          ).items
          assert(
            departments.every((item) => item.resource === 'departments'),
            'getSystemOptions: system:departments:read alone yields only departments'
          )
          const ids = departments.map((item) => item.id)
          assert(
            ids.includes(inside.id) && !ids.includes(outside.id),
            'getSystemOptions: departments follow the read scope (in-scope included, out-of-scope left out)'
          )

          await kit.signIn(roleReader.credentials)
          const roles = expectSuccess(
            await client.call('getSystemOptions'),
            'getSystemOptions'
          ).items
          assert(
            roles.every((item) => item.resource === 'roles') &&
              roles.some((item) => item.id === rolesRole.id),
            'getSystemOptions: system:roles:read alone yields only roles'
          )
        })
      },
    },
    {
      name: "AGENTS.md: reparenting or enabling a department is checked against the editor's pre-change grants: data scopes (updateSystemDepartment → 403 SYSTEM_RULE)",
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const branch = await kit.department()
          const moved = await kit.department()
          const dormant = await kit.department({
            parentId: branch.id,
            enabled: false,
          })
          // An auditor of `branch` and its descendants: any department that
          // joins the branch widens their audit:read scope.
          const auditorRole = await kit.role({
            permissions: ['audit:read'],
            scope: 'descendants',
          })
          const editorRole = await kit.role({
            permissions: [
              'system:departments:read',
              'system:departments:write',
            ],
            scope: 'all',
          })
          await kit.account({
            departmentId: branch.id,
            roleIds: [auditorRole.id],
          })
          const editor = await kit.account({
            departmentId: branch.id,
            roleIds: [editorRole.id],
          })

          await kit.signIn(editor.credentials)
          expectError(
            await client.call('updateSystemDepartment', {
              params: { id: moved.id },
              body: { ...departmentBody(moved), parentId: branch.id },
            }),
            403,
            'SYSTEM_RULE'
          )
          expectError(
            await client.call('updateSystemDepartment', {
              params: { id: dormant.id },
              body: { ...departmentBody(dormant), enabled: true },
            }),
            403,
            'SYSTEM_RULE'
          )

          await kit.asAdmin()
          const reparented = expectSuccess(
            await client.call('updateSystemDepartment', {
              params: { id: moved.id },
              body: { ...departmentBody(moved), parentId: branch.id },
            }),
            'updateSystemDepartment'
          )
          assert(
            reparented.parentId === branch.id,
            'updateSystemDepartment: an editor holding audit:read may reparent'
          )
        })
      },
    },
    {
      name: "AGENTS.md: reparenting or enabling a department is checked against the editor's pre-change grants: capabilities and routes of reactivated accounts (updateSystemDepartment → 403 SYSTEM_RULE)",
      tier: 2,
      async run(client, fixtures) {
        await withFixtures(client, fixtures, async (kit) => {
          await kit.asAdmin()
          const menu = (await listAll(client, 'listSystemMenus')).find(
            (record) =>
              record.kind === 'page' && record.routeId === USERS_ROUTE_ID
          )
          assert(
            menu,
            `listSystemMenus: no page menu for route ${USERS_ROUTE_ID}`
          )
          const office = await kit.department()
          const closed = await kit.department()
          const team = await kit.department({ parentId: closed.id })
          const paused = await kit.department()
          // Self scopes only, so no department scope widens: whatever the
          // editor is refused comes from capabilities or routes.
          const writerRole = await kit.role({
            permissions: ['users:write'],
            scope: 'self',
          })
          const readerRole = await kit.role({
            permissions: ['users:read'],
            scope: 'self',
            menuIds: [menu.id],
          })
          // Holds users:read (all) but neither users:write nor the users menu.
          const editorRole = await kit.role({
            permissions: [
              'system:departments:read',
              'system:departments:write',
              'users:read',
            ],
            scope: 'all',
          })
          await kit.account({ departmentId: team.id, roleIds: [writerRole.id] })
          await kit.account({
            departmentId: paused.id,
            roleIds: [readerRole.id],
          })
          const editor = await kit.account({
            departmentId: office.id,
            roleIds: [editorRole.id],
          })
          // Deactivate both accounts: `team` sits under a disabled parent.
          const setEnabled = async (
            department: DepartmentRecord,
            enabled: boolean
          ) =>
            client.call('updateSystemDepartment', {
              params: { id: department.id },
              body: { ...departmentBody(department), enabled },
            })
          for (const department of [closed, paused])
            expectSuccess(
              await setEnabled(department, false),
              'updateSystemDepartment'
            )
          const attempts: [string, () => ReturnType<typeof setEnabled>][] = [
            [
              'moving a department out from under a disabled parent (reactivates users:write)',
              () =>
                client.call('updateSystemDepartment', {
                  params: { id: team.id },
                  body: { ...departmentBody(team), parentId: office.id },
                }),
            ],
            [
              'enabling the disabled parent (reactivates users:write)',
              () => setEnabled({ ...closed, enabled: false }, true),
            ],
            [
              'enabling a department (reactivates the users route)',
              () => setEnabled({ ...paused, enabled: false }, true),
            ],
          ]

          await kit.signIn(editor.credentials)
          for (const [label, attempt] of attempts) {
            try {
              expectError(await attempt(), 403, 'SYSTEM_RULE')
            } catch (error) {
              throw new ContractAssertionError(
                `updateSystemDepartment ${label}: ${reason(error)}`
              )
            }
          }

          await kit.asAdmin()
          expectSuccess(
            await setEnabled({ ...paused, enabled: false }, true),
            'updateSystemDepartment'
          )
        })
      },
    },
  ]
}
