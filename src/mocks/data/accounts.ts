import {
  type Permission,
  type Role,
  type SessionUser,
} from '@/features/auth/schemas'

/**
 * 演示账号与角色-权限映射。
 *
 * 该映射仅存在于 mock 服务：真实环境中 permissions 由后端
 * 计算后随登录/会话接口下发，前端不做推导。
 */

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['dashboard:read', 'users:read', 'users:write', 'audit:read'],
  operator: ['dashboard:read', 'users:read', 'users:write'],
  viewer: ['dashboard:read', 'users:read'],
}

interface DemoAccount {
  accountNo: string
  name: string
  email: string
  roles: Role[]
}

/**
 * 演示口令规则：角色名首字母大写 + 固定后缀。
 * 这是公开的演示信息（登录页会直接展示），不是机密；
 * 口令按规则即时推导，源码中不落任何口令字面量。
 */
const DEMO_PASSWORD_SUFFIX = '123456'

export function deriveDemoPassword(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1) + DEMO_PASSWORD_SUFFIX
}

const demoAccounts: DemoAccount[] = [
  {
    accountNo: 'ACC-0001',
    name: '系统管理员',
    email: 'admin@example.com',
    roles: ['admin'],
  },
  {
    accountNo: 'ACC-0002',
    name: '运营示例',
    email: 'operator@example.com',
    roles: ['operator'],
  },
  {
    accountNo: 'ACC-0003',
    name: '只读访客',
    email: 'viewer@example.com',
    roles: ['viewer'],
  },
]

export function findDemoAccount(
  email: string,
  candidatePassword?: string
): DemoAccount | undefined {
  const account = demoAccounts.find(
    (item) => item.email.toLowerCase() === email.toLowerCase()
  )
  if (!account) return undefined
  if (
    candidatePassword !== undefined &&
    candidatePassword !== deriveDemoPassword(account.roles[0])
  ) {
    return undefined
  }
  return account
}

export function toSessionUser(account: DemoAccount): SessionUser {
  return {
    accountNo: account.accountNo,
    name: account.name,
    email: account.email,
    roles: account.roles,
    permissions: [
      ...new Set(account.roles.flatMap((role) => rolePermissions[role])),
    ],
  }
}

const TOKEN_PREFIX = 'mock.'
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
}

/**
 * 无状态的演示令牌：内容为 `email:过期时间` 的 base64url。
 * 会话接口可以仅凭令牌本身还原账号并校验过期，
 * 这样刷新页面后会话依然有效（与真实 JWT 的体验一致）。
 */
export function issueMockToken(account: DemoAccount): string {
  const payload = `${account.email}:${Date.now() + TOKEN_TTL_MS}`
  return `${TOKEN_PREFIX}${base64UrlEncode(payload)}`
}

export function resolveMockToken(
  token: string | null | undefined
): DemoAccount | undefined {
  if (!token?.startsWith(TOKEN_PREFIX)) return undefined
  try {
    const [email, expiresAt] = base64UrlDecode(
      token.slice(TOKEN_PREFIX.length)
    ).split(':')
    if (!email || !expiresAt) return undefined
    if (Number(expiresAt) <= Date.now()) return undefined
    return findDemoAccount(email)
  } catch {
    return undefined
  }
}
