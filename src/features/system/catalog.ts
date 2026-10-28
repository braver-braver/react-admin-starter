/** Component/operation registry. Server metadata may select these routes, never code. */
export const routeCatalog = [
  { id: 'dashboard', path: '/', name: '工作台', permission: '' },
  { id: 'users', path: '/users', name: '用户管理', permission: 'users:read' },
  {
    id: 'current-permissions',
    path: '/permissions',
    name: '权限示例',
    permission: 'permissions:read',
  },
  { id: 'audit', path: '/audit', name: '审计日志', permission: 'audit:read' },
  ...(
    ['accounts', 'roles', 'permissions', 'menus', 'departments'] as const
  ).map((resource) => ({
    id: `system-${resource}`,
    path: `/system/${resource}`,
    name: {
      accounts: '登录用户管理',
      roles: '角色管理',
      permissions: '权限管理',
      menus: '菜单管理',
      departments: '部门管理',
    }[resource],
    permission: `system:${resource}:read`,
  })),
] as const
export const resourceNames = {
  accounts: '登录用户',
  roles: '角色',
  permissions: '权限',
  menus: '菜单',
  departments: '部门',
} as const
export type SystemResource = keyof typeof resourceNames
export const scopeNames = {
  all: '全部数据',
  department: '本部门',
  descendants: '本部门及下级',
  self: '仅本人',
  custom: '指定部门',
} as const
export const apiCatalog = [
  {
    permission: 'users:read',
    method: 'GET',
    path: '/api/users',
    name: '查看业务用户',
  },
  {
    permission: 'users:write',
    method: 'POST / PUT / PATCH / DELETE',
    path: '/api/users/*',
    name: '维护业务用户',
  },
  {
    permission: 'permissions:read',
    method: 'GET',
    path: '/api/auth/permissions',
    name: '查看自身权限',
  },
  {
    permission: 'audit:read',
    method: 'GET',
    path: '/api/audit-logs',
    name: '查询审计日志',
  },
  ...Object.entries(resourceNames).flatMap(([key, name]) => [
    {
      permission: `system:${key}:read`,
      method: 'GET',
      path: `/api/system/${key}`,
      name: `查看${name}`,
    },
    {
      permission: `system:${key}:write`,
      method: 'POST / PUT / DELETE',
      path: `/api/system/${key}/*`,
      name: `维护${name}`,
    },
  ]),
]
