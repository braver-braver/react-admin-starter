import { fakerZH_CN as faker } from '@faker-js/faker'
import {
  type AuditAction,
  auditActionValues,
} from '@/features/audit/data/schema'
import { usersStore } from './users'

/**
 * 演示用审计流水（内存态）。登录、用户增删改等操作会实时追加记录，
 * 种子数据用于首屏展示。仅持有 audit:read 的账户可查询。
 */
export type MockAuditLog = {
  id: string
  createdAt: string
  actorName: string
  actorEmail: string
  action: AuditAction
  target: string
  detail: string
  ip: string
}

export const auditLogsStore: MockAuditLog[] = []

const SEED_ACTION_COUNT = 7

function detailFor(action: AuditAction, index: number): string {
  switch (action) {
    case 'user.created':
      return '创建用户并分配角色'
    case 'user.updated':
      return '更新用户资料'
    case 'user.deleted':
      return '删除用户'
    case 'user.batch_deleted':
      return `批量删除 ${(index % 3) + 2} 个用户`
    case 'user.status_changed':
      return `变更用户状态为${index % 2 === 0 ? '启用' : '停用'}`
    case 'user.invited':
      return '邀请用户加入'
    case 'user.batch_invited':
      return `批量邀请 ${(index % 3) + 2} 个用户`
    default:
      return '演示记录'
  }
}

function seedAuditLogs(): void {
  faker.seed(20261028)
  const actions = auditActionValues.slice(2) as AuditAction[]
  const now = Date.now()
  for (let index = 0; index < 46; index++) {
    const target = usersStore[index % usersStore.length]
    const actor = usersStore[(index * 7) % usersStore.length]
    const action = actions[index % SEED_ACTION_COUNT]
    auditLogsStore.push({
      id: `log-${String(index + 1).padStart(4, '0')}`,
      createdAt: new Date(now - index * 3.7 * 60 * 60 * 1000).toISOString(),
      actorName: `${actor.lastName}${actor.firstName}`,
      actorEmail: actor.email,
      action,
      target: `${target.username}（${target.email}）`,
      detail: detailFor(action, index),
      ip: faker.internet.ip(),
    })
  }
}

seedAuditLogs()

let nextLogId = auditLogsStore.length + 1

export function appendAuditLog(
  entry: Omit<MockAuditLog, 'id' | 'createdAt'> & { createdAt?: string }
): MockAuditLog {
  const log: MockAuditLog = {
    id: `log-${String(nextLogId++).padStart(4, '0')}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    ...entry,
  }
  auditLogsStore.unshift(log)
  return log
}
