import { beforeEach, describe, expect, it } from 'vitest'
import { type Role } from '@/features/system/schema'
import {
  accountById,
  canAccessData,
  changeSystem,
  principal,
  resetSystemStore,
  systemStore,
  visibleNavigation,
} from './system'

const admin = () => principal('demo-admin')!
const roleBody = (scope: Role['scope'] = 'department') => ({
  name: '部门经办人',
  code: 'operator',
  enabled: true,
  permissionIds: ['users:read', 'users:write'],
  menuIds: ['users'],
  scope,
  departmentIds: scope === 'custom' ? ['sales'] : [],
})
function fields(record: { id: string; protected: boolean; resource: string }) {
  const {
    id: _id,
    protected: _protected,
    resource: _resource,
    ...body
  } = record
  return body
}
async function operator(scope: Role['scope'] = 'department') {
  const role = await changeSystem('roles', undefined, roleBody(scope), admin())
  if (!('id' in role)) throw new Error('Missing role')
  const account = await changeSystem(
    'accounts',
    undefined,
    {
      name: '运营经办',
      email: 'operator@example.com',
      password: 'Operator123!',
      enabled: true,
      departmentId: 'operations',
      roleIds: [role.id],
    },
    admin()
  )
  if (!('id' in account)) throw new Error('Missing account')
  return { role, account, user: principal(account.id)! }
}
describe('system authorization kernel', () => {
  beforeEach(resetSystemStore)
  it.each(['all', 'department', 'descendants', 'self', 'custom'] as const)(
    'enforces %s data scope from live role state',
    async (scope) => {
      const { user } = await operator(scope)
      expect(
        canAccessData(user, { departmentId: 'operations', createdBy: 'other' })
      ).toBe(
        scope === 'all' || scope === 'department' || scope === 'descendants'
      )
      expect(
        canAccessData(user, { departmentId: 'support', createdBy: 'other' })
      ).toBe(scope === 'all' || scope === 'descendants')
      expect(
        canAccessData(user, { departmentId: 'sales', createdBy: 'other' })
      ).toBe(scope === 'all' || scope === 'custom')
      expect(
        canAccessData(user, { departmentId: 'sales', createdBy: user.id })
      ).toBe(scope === 'all' || scope === 'custom' || scope === 'self')
    }
  )
  it('takes the union of active roles and immediately withdraws revoked grants', async () => {
    const { role, account } = await operator('department')
    const second = await changeSystem(
      'roles',
      undefined,
      {
        ...roleBody('custom'),
        code: 'sales_reader',
        permissionIds: ['users:read'],
      },
      admin()
    )
    if (!('id' in second) || account.resource !== 'accounts')
      throw new Error('Missing records')
    await changeSystem(
      'accounts',
      account.id,
      { ...fields(account), roleIds: [role.id, second.id] },
      admin()
    )
    let user = principal(account.id)!
    expect(canAccessData(user, { departmentId: 'operations' })).toBe(true)
    expect(canAccessData(user, { departmentId: 'sales' })).toBe(true)
    await changeSystem(
      'roles',
      role.id,
      { ...fields(role), enabled: false },
      admin()
    )
    user = principal(account.id)!
    expect(user.permissions).not.toContain('users:write')
    expect(canAccessData(user, { departmentId: 'operations' })).toBe(false)
  })
  it('does not combine a read-all role with a write-self role into write-all access', async () => {
    const { account, role } = await operator('self')
    const reader = await changeSystem(
      'roles',
      undefined,
      {
        ...roleBody('all'),
        code: 'global_reader',
        permissionIds: ['users:read'],
      },
      admin()
    )
    if (!('id' in reader) || account.resource !== 'accounts')
      throw new Error('Missing records')
    await changeSystem(
      'accounts',
      account.id,
      { ...fields(account), roleIds: [role.id, reader.id] },
      admin()
    )
    const user = principal(account.id)!
    const other = { departmentId: 'sales', createdBy: 'other' }
    expect(canAccessData(user, other, 'users:read')).toBe(true)
    expect(canAccessData(user, other, 'users:write')).toBe(false)
    expect(
      canAccessData(user, { ...other, createdBy: user.id }, 'users:write')
    ).toBe(true)
  })
  it('distinguishes hidden navigation from disabled routes, and keeps the recovery entry', async () => {
    const menu = systemStore().records.find(
      (entry) => entry.resource === 'menus' && entry.id === 'users'
    )!
    await changeSystem(
      'menus',
      menu.id,
      { ...fields(menu), visible: false },
      admin()
    )
    expect(
      visibleNavigation(admin()).some((entry) => entry.id === 'users')
    ).toBe(false)
    expect(admin().routes).toContain('/users')
    await changeSystem(
      'menus',
      menu.id,
      { ...fields(menu), enabled: false },
      admin()
    )
    expect(admin().routes).not.toContain('/users')
    await expect(
      changeSystem('menus', 'system-menus', null, admin(), true)
    ).rejects.toMatchObject({ status: 409 })
  })
  it('rejects arbitrary routes, department cycles, references and protected administrator changes', async () => {
    await expect(
      changeSystem(
        'menus',
        undefined,
        {
          name: '外部脚本',
          parentId: '',
          kind: 'page',
          routeId: 'https://evil.invalid',
          order: 1,
          enabled: true,
          visible: true,
        },
        admin()
      )
    ).rejects.toMatchObject({ status: 422 })
    const department = systemStore().records.find(
      (entry) => entry.id === 'operations'
    )!
    await expect(
      changeSystem(
        'departments',
        department.id,
        { ...fields(department), parentId: 'support' },
        admin()
      )
    ).rejects.toMatchObject({ status: 422 })
    await expect(
      changeSystem('departments', 'operations', null, admin(), true)
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      changeSystem(
        'accounts',
        'demo-admin',
        { ...fields(accountById('demo-admin')!), enabled: false },
        admin()
      )
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      changeSystem('roles', 'admin', null, admin(), true)
    ).rejects.toMatchObject({ status: 409 })
  })
  it('prevents privilege escalation even on a disabled account and validates stale queued credentials', async () => {
    const { account, role } = await operator()
    if (role.resource !== 'roles') throw new Error('Missing role')
    await changeSystem(
      'roles',
      role.id,
      {
        ...fields(role),
        permissionIds: ['users:read', 'system:accounts:write'],
      },
      admin()
    )
    const limited = principal(account.id)!
    await expect(
      changeSystem(
        'accounts',
        undefined,
        {
          name: '越权账号',
          email: 'escalate@example.com',
          password: 'Escalate123!',
          enabled: false,
          departmentId: 'operations',
          roleIds: ['viewer'],
        },
        limited
      )
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      changeSystem(
        'accounts',
        account.id,
        { ...fields(account), roleIds: ['admin'] },
        limited
      )
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      changeSystem('accounts', account.id, fields(account), admin(), false, -1)
    ).rejects.toMatchObject({ status: 401 })
  })
  it('serializes concurrent writes, preserves state on errors and never returns credential material', async () => {
    const make = (suffix: string) =>
      changeSystem(
        'accounts',
        undefined,
        {
          name: suffix,
          email: `${suffix}@example.com`,
          password: 'Account123!',
          enabled: true,
          departmentId: 'operations',
          roleIds: ['guest'],
        },
        admin()
      )
    const results = await Promise.all([make('first'), make('second')])
    expect(
      systemStore().records.filter((record) => record.resource === 'accounts')
    ).toHaveLength(5)
    expect(JSON.stringify(results)).not.toContain('hash')
    expect(JSON.stringify(results)).not.toContain('Account123!')
    await expect(make('first')).rejects.toMatchObject({ status: 409 })
    expect(
      systemStore().records.filter((record) => record.resource === 'accounts')
    ).toHaveLength(5)
  })
})
