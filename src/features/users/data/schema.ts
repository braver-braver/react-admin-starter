import { z } from 'zod'

export const userStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('invited'),
  z.literal('suspended'),
])
export type UserStatus = z.infer<typeof userStatusSchema>

export const userRoleSchema = z.union([
  z.literal('superadmin'),
  z.literal('admin'),
  z.literal('cashier'),
  z.literal('manager'),
])
export type UserRole = z.infer<typeof userRoleSchema>

export const userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema,
  role: userRoleSchema,
  avatarUrl: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = z.infer<typeof userSchema>

/** 分页列表响应：分页、筛选、排序全部由服务端计算 */
export const userListResponseSchema = z.object({
  items: z.array(userSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPageCount: z.number(),
  }),
})
export type UserListResponse = z.infer<typeof userListResponseSchema>

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
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  role: string
  password?: string
  avatarUrl?: string
}
