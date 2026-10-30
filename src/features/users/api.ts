import { successSchema } from '@/contract/common'
import {
  deletedCountSchema,
  invitedCountSchema,
  updatedCountSchema,
  userListResponseSchema,
  userSchema,
  type UserBulkStatus,
  type UserInvitePayload,
  type UsersListParams,
  type UserWritePayload,
} from '@/contract/users'
import { apiRequest } from '@/lib/api'

/**
 * 用户管理 API：全部经共享 apiRequest，响应由 zod 校验。
 * 分页、筛选、排序与授权都由服务端执行（users:read / users:write）。
 * 请求与查询参数的类型来自 src/contract，不在这里手写。
 */

function toSearchParams(params: UsersListParams): URLSearchParams {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('pageSize', String(params.pageSize))
  if (params.username) search.set('username', params.username)
  for (const status of params.status ?? []) search.append('status', status)
  for (const role of params.role ?? []) search.append('role', role)
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.sortOrder) search.set('sortOrder', params.sortOrder)
  return search
}

export function fetchUsers(params: UsersListParams) {
  return apiRequest(
    `/api/users?${toSearchParams(params)}`,
    userListResponseSchema
  )
}

export function createUser(payload: UserWritePayload) {
  return apiRequest('/api/users', userSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id: string, payload: UserWritePayload) {
  return apiRequest(`/api/users/${id}`, userSchema, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteUser(id: string) {
  return apiRequest(`/api/users/${id}`, successSchema, {
    method: 'DELETE',
  })
}

export function batchDeleteUsers(ids: string[]) {
  return apiRequest('/api/users/batch-delete', deletedCountSchema, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function updateUsersStatus(ids: string[], status: UserBulkStatus) {
  return apiRequest('/api/users/status', updatedCountSchema, {
    method: 'PATCH',
    body: JSON.stringify({ ids, status }),
  })
}

export function inviteUser(payload: UserInvitePayload) {
  return apiRequest('/api/users/invite', userSchema, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function batchInviteUsers(ids: string[]) {
  return apiRequest('/api/users/invite-batch', invitedCountSchema, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}
