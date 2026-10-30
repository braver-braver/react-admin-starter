// Response schemas live in the API contract; re-exported so UI imports stay stable.
export * from '@/contract/users'

export type UsersListParams = {
  page: number
  pageSize: number
  username?: string
  status?: string[]
  role?: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** 新建/编辑用户的可写字段；编辑时 password 可省略 */
export type UserWritePayload = {
  departmentId?: string
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  role: string
  password?: string
  avatarUrl?: string
}
