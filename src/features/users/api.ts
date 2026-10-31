import {
  type UserBulkStatus,
  type UserInvitePayload,
  type UsersListParams,
  type UserWritePayload,
} from '@/contract/users'
import { callOperation } from '@/lib/api'

/**
 * 用户管理 API：路径、方法、请求体编码与响应校验都来自契约注册表。
 * 分页、筛选、排序与授权都由服务端执行（users:read / users:write）。
 */

export const fetchUsers = (query: UsersListParams) =>
  callOperation('listUsers', { query })

export const createUser = (body: UserWritePayload) =>
  callOperation('createUser', { body })

export const updateUser = (id: string, body: UserWritePayload) =>
  callOperation('updateUser', { params: { id }, body })

export const deleteUser = (id: string) =>
  callOperation('deleteUser', { params: { id } })

export const batchDeleteUsers = (ids: string[]) =>
  callOperation('batchDeleteUsers', { body: { ids } })

export const updateUsersStatus = (ids: string[], status: UserBulkStatus) =>
  callOperation('updateUsersStatus', { body: { ids, status } })

export const inviteUser = (body: UserInvitePayload) =>
  callOperation('inviteUser', { body })

export const batchInviteUsers = (ids: string[]) =>
  callOperation('inviteUsersBatch', { body: { ids } })
