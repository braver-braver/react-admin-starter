import { z } from 'zod'
import { pageMetaSchema, wireDate } from './common.ts'

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
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  createdBy: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema,
  role: userRoleSchema,
  avatarUrl: z.string().optional(),
  createdAt: wireDate,
  updatedAt: wireDate,
})
export type User = z.infer<typeof userSchema>

/** 分页列表响应：分页、筛选、排序全部由服务端计算 */
export const userListResponseSchema = z.object({
  items: z.array(userSchema),
  meta: pageMetaSchema,
})
export type UserListResponse = z.infer<typeof userListResponseSchema>
