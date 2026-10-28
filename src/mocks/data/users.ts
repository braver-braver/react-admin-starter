import { fakerZH_CN as faker } from '@faker-js/faker'
import { type UserRole, type UserStatus } from '@/features/users/data/schema'

/**
 * 演示用用户数据（内存态，刷新后重置为种子数据）。
 * 与 src/features/users/data/schema.ts 的 User 契约保持一致；
 * 日期以 ISO 字符串出参，由前端 zod coerce。
 */
export type MockUser = {
  id: string
  departmentId: string
  createdBy: string
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  status: UserStatus
  role: UserRole
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

const STATUSES: UserStatus[] = [
  'active',
  'active',
  'active',
  'inactive',
  'invited',
  'suspended',
]
const ROLES: UserRole[] = [
  'admin',
  'manager',
  'manager',
  'cashier',
  'cashier',
  'superadmin',
]
const SURNAME_PINYIN = [
  'zhang',
  'wang',
  'li',
  'zhao',
  'liu',
  'chen',
  'yang',
  'huang',
  'wu',
  'zhou',
  'xu',
  'sun',
  'ma',
  'zhu',
  'hu',
  'guo',
]
const GIVEN_PINYIN = [
  'wei',
  'fang',
  'na',
  'min',
  'jing',
  'lei',
  'yang',
  'yan',
  'tao',
  'ming',
  'chao',
  'xin',
  'yu',
  'hao',
  'jun',
  'qiang',
  'juan',
  'ping',
  'gang',
  'hui',
]

const USER_COUNT = 120

function seedUsers(): MockUser[] {
  faker.seed(20261028)
  const seenUsernames = new Set<string>()
  const users: MockUser[] = []
  for (let index = 0; index < USER_COUNT; index++) {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const surname = SURNAME_PINYIN[index % SURNAME_PINYIN.length]
    const given = GIVEN_PINYIN[(index * 7) % GIVEN_PINYIN.length]
    let username = `${surname}_${given}`
    if (seenUsernames.has(username)) username = `${username}${index}`
    seenUsernames.add(username)

    const createdAt = faker.date.past({ years: 1 })
    users.push({
      id: `usr-${String(index + 1).padStart(4, '0')}`,
      departmentId: ['operations', 'support', 'sales'][index % 3],
      createdBy: index % 2 === 0 ? 'demo-admin' : 'demo-viewer',
      firstName,
      lastName,
      username,
      email: `${surname}.${given}.${index + 1}@example.com`,
      phoneNumber: faker.phone.number({ style: 'international' }),
      status: STATUSES[index % STATUSES.length],
      role: ROLES[index % ROLES.length],
      createdAt: createdAt.toISOString(),
      updatedAt: faker.date
        .between({ from: createdAt, to: new Date() })
        .toISOString(),
    })
  }
  return users
}

export const usersStore: MockUser[] = seedUsers()

let nextUserId = USER_COUNT + 1

export function createUserId(): string {
  return `usr-${String(nextUserId++).padStart(4, '0')}`
}

export function findUserByEmailOrUsername(
  email: string,
  username: string,
  exceptId?: string
): MockUser | undefined {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim().toLowerCase()
  return usersStore.find(
    (user) =>
      user.id !== exceptId &&
      (user.email.toLowerCase() === normalizedEmail ||
        user.username.toLowerCase() === normalizedUsername)
  )
}
