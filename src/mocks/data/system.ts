import { z } from 'zod'
import { canAccessData } from '@/lib/data-scope'
import { type AuthUser } from '@/features/auth/schema'
import {
  apiCatalog,
  routeCatalog,
  type SystemResource,
} from '@/features/system/catalog'
import {
  accountInput,
  departmentInput,
  menuInput,
  permissionInput,
  roleInput,
  systemRecordSchema,
  type Account,
  type Menu,
  type Role,
  type SystemRecord,
} from '@/features/system/schema'

export { canAccessData } from '@/lib/data-scope'

const storageKey = `react-admin-starter:system-v1:${import.meta.env.BASE_URL}`
const storeSchema = z.object({
  records: z.array(systemRecordSchema),
  credentials: z.record(
    z.string(),
    z.object({ hash: z.string(), version: z.number().int() })
  ),
})
type Store = z.infer<typeof storeSchema>
let cached: Store | undefined
export class SystemError extends Error {
  constructor(
    public status: 401 | 403 | 404 | 409 | 422,
    message: string
  ) {
    super(message)
  }
}
const deny = (message: string): never => {
  throw new SystemError(403, message)
}
const conflict = (message: string): never => {
  throw new SystemError(409, message)
}
const invalid = (message: string): never => {
  throw new SystemError(422, message)
}
const recordsOf = (db: Store, resource: SystemResource) =>
  db.records.filter((record) => record.resource === resource)
function seed(): Store {
  const permissions: SystemRecord[] = apiCatalog.map((entry) => ({
    resource: 'permissions',
    id: entry.permission,
    code: entry.permission,
    name: entry.name,
    description: `${entry.method} ${entry.path}`,
    protected: true,
  }))
  const menus: Menu[] = [
    {
      resource: 'menus',
      id: 'business',
      name: '业务示例',
      parentId: '',
      kind: 'directory',
      routeId: '',
      enabled: true,
      visible: true,
      order: 20,
      protected: false,
    },
    {
      resource: 'menus',
      id: 'system',
      name: '系统管理',
      parentId: '',
      kind: 'directory',
      routeId: '',
      enabled: true,
      visible: true,
      order: 10,
      protected: true,
    },
    ...routeCatalog.map(
      (route, index): Menu => ({
        resource: 'menus',
        id: route.id,
        name: route.name,
        kind: 'page',
        routeId: route.id,
        parentId: route.id.startsWith('system-')
          ? 'system'
          : route.id === 'dashboard'
            ? ''
            : 'business',
        enabled: true,
        visible: true,
        order: index,
        protected: route.id === 'dashboard' || route.id === 'system-menus',
      })
    ),
  ]
  const roles: Role[] = [
    {
      resource: 'roles',
      id: 'admin',
      name: '超级管理员',
      code: 'admin',
      enabled: true,
      permissionIds: permissions.map((p) => p.id),
      menuIds: menus.map((m) => m.id),
      scope: 'all',
      departmentIds: [],
      protected: true,
    },
    {
      resource: 'roles',
      id: 'viewer',
      name: '只读用户',
      code: 'viewer',
      enabled: true,
      permissionIds: ['users:read', 'permissions:read'],
      menuIds: ['dashboard', 'users', 'current-permissions'],
      scope: 'all',
      departmentIds: [],
      protected: false,
    },
    {
      resource: 'roles',
      id: 'guest',
      name: '受限访客',
      code: 'guest',
      enabled: true,
      permissionIds: [],
      menuIds: ['dashboard'],
      scope: 'self',
      departmentIds: [],
      protected: false,
    },
  ]
  const accounts: Account[] = ['admin', 'viewer', 'guest'].map((key) => ({
    resource: 'accounts',
    id: `demo-${key}`,
    name:
      key === 'admin'
        ? '演示管理员'
        : key === 'viewer'
          ? '演示只读用户'
          : '演示受限用户',
    email: `${key}@example.com`,
    enabled: true,
    departmentId: key === 'admin' ? 'root' : 'operations',
    roleIds: [key],
    protected: key === 'admin',
  }))
  return {
    records: [
      ...permissions,
      ...menus,
      ...roles,
      ...accounts,
      {
        resource: 'departments',
        id: 'root',
        name: '组织总部',
        code: 'root',
        parentId: '',
        enabled: true,
        protected: true,
      },
      {
        resource: 'departments',
        id: 'operations',
        name: '运营部',
        code: 'operations',
        parentId: 'root',
        enabled: true,
        protected: false,
      },
      {
        resource: 'departments',
        id: 'support',
        name: '客户支持组',
        code: 'support',
        parentId: 'operations',
        enabled: true,
        protected: false,
      },
      {
        resource: 'departments',
        id: 'sales',
        name: '销售部',
        code: 'sales',
        parentId: 'root',
        enabled: true,
        protected: false,
      },
    ],
    credentials: Object.fromEntries(
      accounts.map((account) => [
        account.id,
        {
          hash: '7dbb7f051b44d7d54584a7bc6c32f00da5a3b5e6973485b9fb176fe56346b3e3',
          version: 0,
        },
      ])
    ),
  }
}
export function systemStore(): Store {
  if (!cached) {
    const parsed = storeSchema.safeParse(
      JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    )
    cached = parsed.success ? parsed.data : seed()
  }
  return cached
}
export function resetSystemStore() {
  cached = undefined
  sessionStorage.removeItem(storageKey)
}
export async function passwordHash(password: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  )
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('')
}
export function accountById(id: string, db = systemStore()) {
  return db.records.find(
    (entry): entry is Account =>
      entry.resource === 'accounts' && entry.id === id
  )
}
function activeDepartment(id: string, db: Store): boolean {
  const visited = new Set<string>()
  while (id) {
    if (visited.has(id)) return false
    visited.add(id)
    const department = db.records.find(
      (entry) => entry.resource === 'departments' && entry.id === id
    )
    if (
      !department ||
      department.resource !== 'departments' ||
      !department.enabled
    )
      return false
    id = department.parentId
  }
  return true
}
function descendants(id: string, db: Store) {
  const result = new Set([id])
  for (let index = 0; index < db.records.length; index++) {
    for (const department of recordsOf(db, 'departments')) {
      if (
        department.resource === 'departments' &&
        result.has(department.parentId)
      )
        result.add(department.id)
    }
  }
  return result
}
function accountRoles(account: Account, db: Store) {
  return db.records.filter(
    (entry): entry is Role =>
      entry.resource === 'roles' &&
      entry.enabled &&
      account.roleIds.includes(entry.id)
  )
}
function dataScope(account: Account, roles: Role[], db: Store) {
  const scope = { all: false, self: false, departments: [] as string[] }
  const departments = new Set<string>()
  for (const role of roles) {
    if (role.scope === 'all') scope.all = true
    if (role.scope === 'self') scope.self = true
    if (role.scope === 'department') departments.add(account.departmentId)
    if (role.scope === 'descendants')
      descendants(account.departmentId, db).forEach((id) => departments.add(id))
    if (role.scope === 'custom')
      role.departmentIds.forEach((id) => departments.add(id))
  }
  scope.departments = [...departments].filter((id) => activeDepartment(id, db))
  return scope
}
export function visibleNavigation(
  user: AuthUser,
  db = systemStore(),
  visibleOnly = true
): Menu[] {
  const account = accountById(user.id, db)
  if (!account) return []
  const roles = accountRoles(account, db)
  const grants = new Set(roles.flatMap((role) => role.menuIds))
  const menus = db.records.filter(
    (entry): entry is Menu => entry.resource === 'menus'
  )
  const allowed = menus.filter((menu) => {
    const parent = menus.find((entry) => entry.id === menu.parentId)
    if (
      menu.kind !== 'page' ||
      !menu.enabled ||
      (parent && !parent.enabled) ||
      (visibleOnly && (!menu.visible || (parent && !parent.visible)))
    )
      return false
    if (
      menu.routeId !== 'dashboard' &&
      !roles.some((role) => role.id === 'admin') &&
      !grants.has(menu.id) &&
      !grants.has(menu.parentId)
    )
      return false
    const route = routeCatalog.find((entry) => entry.id === menu.routeId)
    return (
      !!route &&
      (!route.permission || user.permissions.includes(route.permission))
    )
  })
  const parentIds = new Set(allowed.map((menu) => menu.parentId))
  return menus
    .filter((menu) => allowed.includes(menu) || parentIds.has(menu.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
export function principal(
  id: string,
  db = systemStore()
): AuthUser | undefined {
  const account = accountById(id, db)
  if (!account?.enabled || !activeDepartment(account.departmentId, db))
    return undefined
  const roles = accountRoles(account, db)
  const grants = new Set(roles.flatMap((role) => role.permissionIds))
  const permissions = db.records
    .filter(
      (entry) =>
        entry.resource === 'permissions' &&
        (roles.some((role) => role.id === 'admin') || grants.has(entry.id))
    )
    .map((entry) => (entry.resource === 'permissions' ? entry.code : ''))
  const user: AuthUser = {
    id,
    email: account.email,
    name: account.name,
    roles: roles.map((role) => role.code),
    permissions,
    departmentId: account.departmentId,
    dataScope: dataScope(account, roles, db),
    routes: [],
  }
  user.dataScopes = Object.fromEntries(
    permissions.map((permission) => {
      const capability = db.records.find(
        (entry) => entry.resource === 'permissions' && entry.code === permission
      )
      return [
        permission,
        dataScope(
          account,
          roles.filter(
            (role) =>
              role.id === 'admin' ||
              (capability && role.permissionIds.includes(capability.id))
          ),
          db
        ),
      ]
    })
  )
  user.routes = visibleNavigation(user, db, false)
    .filter((menu) => menu.kind === 'page')
    .map(
      (menu) => routeCatalog.find((route) => route.id === menu.routeId)!.path
    )
  return user
}
function references(ids: string[], kind: SystemResource, db: Store) {
  if (
    ids.some(
      (id) =>
        !db.records.some(
          (record) => record.resource === kind && record.id === id
        )
    )
  )
    invalid('所选关联记录不存在，请刷新后重试。')
}
async function applyChange(
  resource: SystemResource,
  id: string | undefined,
  body: unknown,
  actor: AuthUser,
  remove = false,
  expectedCredentialVersion?: number
): Promise<SystemRecord | { success: true }> {
  const freshActor = principal(actor.id)
  if (
    !freshActor ||
    (expectedCredentialVersion !== undefined &&
      systemStore().credentials[actor.id]?.version !==
        expectedCredentialVersion)
  )
    throw new SystemError(401, '登录状态已变化，请重新登录。')
  actor = freshActor
  if (!actor.permissions.includes(`system:${resource}:write`))
    deny('没有执行该操作的权限。')
  const db = structuredClone(systemStore())
  const existing = id
    ? db.records.find(
        (record) => record.resource === resource && record.id === id
      )
    : undefined
  if (id && !existing) throw new SystemError(404, '记录不存在，请刷新后重试。')
  if (
    resource !== 'accounts' &&
    !actor.dataScopes?.[`system:${resource}:write`]?.all
  )
    deny('系统配置需要全部数据范围。')
  if (
    existing?.resource === 'accounts' &&
    !canAccessData(actor, existing, 'system:accounts:write')
  )
    deny('不能访问其他部门的账号。')
  if (existing?.protected && (remove || resource !== 'permissions'))
    conflict('内置恢复入口和超级管理员不可变更。')
  if (remove && existing) {
    const referenced = db.records.some(
      (record) =>
        (record.resource === 'accounts' &&
          ((resource === 'roles' && record.roleIds.includes(id!)) ||
            (resource === 'departments' && record.departmentId === id))) ||
        (record.resource === 'roles' &&
          record.id !== 'admin' &&
          ((resource === 'permissions' && record.permissionIds.includes(id!)) ||
            (resource === 'menus' && record.menuIds.includes(id!)) ||
            (resource === 'departments' &&
              record.departmentIds.includes(id!)))) ||
        ((record.resource === 'menus' || record.resource === 'departments') &&
          record.resource === resource &&
          record.parentId === id)
    )
    if (referenced) conflict('该记录仍被引用，请先解除关联或处理下级。')
    db.records = db.records.filter((record) => record !== existing)
    delete db.credentials[id!]
  } else {
    const common = {
      id: id ?? crypto.randomUUID(),
      protected: existing?.protected ?? false,
    }
    let record: SystemRecord
    switch (resource) {
      case 'accounts': {
        const input = accountInput.parse(body)
        references(input.roleIds, 'roles', db)
        references([input.departmentId], 'departments', db)
        if (!activeDepartment(input.departmentId, db))
          invalid('请选择启用的部门。')
        if (input.roleIds.includes('admin'))
          deny('超级管理员角色仅保留给内置恢复账号。')
        if (
          recordsOf(db, 'accounts').some(
            (other) =>
              other.resource === 'accounts' &&
              other.id !== id &&
              other.email === input.email
          )
        )
          conflict('该邮箱已存在。')
        if (!id && !input.password) invalid('创建登录用户必须设置初始密码。')
        const { password, ...publicInput } = input
        record = { ...common, resource, ...publicInput }
        if (!canAccessData(actor, record, 'system:accounts:write'))
          deny('账号部门超出当前数据范围。')
        const candidate = principal(record.id, {
          ...db,
          records: [
            ...db.records
              .filter((item) => item.id !== record.id)
              .map((item) =>
                item.resource === 'roles' && input.roleIds.includes(item.id)
                  ? { ...item, enabled: true }
                  : item
              ),
            { ...record, enabled: true },
          ],
        })
        if (
          candidate?.permissions.some(
            (permission) => !actor.permissions.includes(permission)
          )
        )
          deny('不能授予自己未持有的权限。')
        if (candidate) {
          for (const permission of candidate.permissions) {
            const granted = candidate.dataScopes?.[permission]
            const own = actor.dataScopes?.[permission]
            if (
              !own ||
              (!own.all &&
                (granted?.all ||
                  granted?.departments.some(
                    (department) => !own.departments.includes(department)
                  ) ||
                  (granted?.self && !(own.self && actor.id === record.id))))
            )
              deny('不能授予超出自身的数据范围。')
          }
        }
        if (
          existing?.resource === 'accounts' &&
          existing.enabled !== input.enabled &&
          !password
        )
          db.credentials[record.id].version += 1
        if (password)
          db.credentials[record.id] = {
            hash: await passwordHash(password),
            version: (db.credentials[record.id]?.version ?? -1) + 1,
          }
        break
      }
      case 'roles': {
        const input = roleInput.parse(body)
        references(input.permissionIds, 'permissions', db)
        references(input.menuIds, 'menus', db)
        references(input.departmentIds, 'departments', db)
        const codes = recordsOf(db, 'permissions')
          .filter((p) => input.permissionIds.includes(p.id))
          .map((p) => (p.resource === 'permissions' ? p.code : ''))
        if (codes.some((permission) => !actor.permissions.includes(permission)))
          deny('不能授予自己未持有的权限。')
        record = { ...common, resource, ...input }
        break
      }
      case 'permissions': {
        const input = permissionInput.parse(body)
        if (
          existing?.resource === 'permissions' &&
          existing.protected &&
          input.code !== existing.code
        )
          conflict('内置权限代码不可修改。')
        record = { ...common, resource, ...input }
        break
      }
      case 'menus': {
        const input = menuInput.parse(body)
        if (input.parentId) {
          const parent = db.records.find(
            (entry) => entry.resource === 'menus' && entry.id === input.parentId
          )
          if (
            !parent ||
            parent.resource !== 'menus' ||
            parent.kind !== 'directory' ||
            input.kind !== 'page' ||
            input.parentId === id
          )
            invalid('目录必须位于根层，页面只能挂在根层或目录下。')
        }
        if (input.kind === 'directory' && input.routeId)
          invalid('目录不绑定页面。')
        if (
          input.kind === 'page' &&
          !routeCatalog.some((route) => route.id === input.routeId)
        )
          invalid('只能绑定已注册页面。')
        if (
          db.records.some(
            (entry) =>
              entry.resource === 'menus' &&
              entry.id !== id &&
              input.kind === 'page' &&
              entry.routeId === input.routeId
          )
        )
          conflict('该页面已有菜单，请编辑现有菜单。')
        if (
          existing?.resource === 'menus' &&
          existing.kind === 'directory' &&
          input.kind !== 'directory' &&
          db.records.some(
            (entry) => entry.resource === 'menus' && entry.parentId === id
          )
        )
          conflict('请先移走目录中的页面。')
        record = { ...common, resource, ...input }
        break
      }
      case 'departments': {
        const input = departmentInput.parse(body)
        if (!input.parentId) invalid('新部门必须选择上级部门。')
        references([input.parentId], 'departments', db)
        if (!activeDepartment(input.parentId, db)) invalid('上级部门必须启用。')
        if (id && descendants(id, db).has(input.parentId))
          invalid('上级部门不能是自身或下级部门。')
        record = { ...common, resource, ...input }
        break
      }
    }
    if (
      'code' in record &&
      db.records.some(
        (entry) =>
          entry.resource === resource &&
          entry.id !== id &&
          'code' in entry &&
          entry.code === record.code
      )
    )
      conflict('该代码已存在。')
    db.records = [...db.records.filter((entry) => entry !== existing), record]
  }
  const administrator = db.records.find(
    (entry) => entry.resource === 'roles' && entry.id === 'admin'
  )
  if (administrator?.resource === 'roles') {
    administrator.permissionIds = recordsOf(db, 'permissions').map(
      (entry) => entry.id
    )
    administrator.menuIds = recordsOf(db, 'menus').map((entry) => entry.id)
  }
  sessionStorage.setItem(storageKey, JSON.stringify(db))
  cached = db
  return remove
    ? { success: true }
    : db.records.find(
        (entry) =>
          entry.resource === resource &&
          entry.id === (id ?? db.records[db.records.length - 1]?.id)
      )!
}

// Serialize read/modify/persist, including asynchronous password hashing.
let writes = Promise.resolve()
export function changeSystem(...args: Parameters<typeof applyChange>) {
  const result = writes.then(() => applyChange(...args))
  writes = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
