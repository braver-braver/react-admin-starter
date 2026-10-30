import { z } from 'zod'
import { idListSchema, pageMetaSchema } from '@/lib/contract-schemas'

export const userStatusSchema = z.enum([
  'active',
  'inactive',
  'invited',
  'suspended',
])
export type UserStatus = z.infer<typeof userStatusSchema>

export const userRoleSchema = z.enum([
  'superadmin',
  'admin',
  'manager',
  'cashier',
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
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = z.infer<typeof userSchema>

/** 分页列表响应：分页、筛选、排序全部由服务端计算 */
export const userListResponseSchema = z.object({
  items: z.array(userSchema),
  meta: pageMetaSchema,
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

export const userSortKeys = [
  'username',
  'fullName',
  'email',
  'phoneNumber',
  'status',
  'role',
  'createdAt',
  'updatedAt',
] as const

/** GET /api/users query string; arrays are sent as repeated keys. */
export const usersQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).default(10),
  username: z
    .string()
    .describe('Matches username, email, full name or phone number.')
    .optional(),
  status: z.array(userStatusSchema).optional(),
  role: z.array(userRoleSchema).optional(),
  sortBy: z.enum(userSortKeys).default('username'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

/** 新建/编辑用户的可写字段；编辑时 password 可省略 */
export const userWriteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  username: z.string().min(1),
  email: z.email(),
  phoneNumber: z.string().min(1),
  role: userRoleSchema,
  password: z.string().min(8).optional(),
  departmentId: z
    .string()
    .describe('Must be inside the actor users:write scope.')
    .optional(),
  avatarUrl: z.string().optional(),
})
export type UserWritePayload = z.input<typeof userWriteSchema>

/** POST /api/users/invite */
export const userInviteSchema = z.object({
  email: z.email(),
  role: userRoleSchema,
  desc: z.string().optional(),
})

/** PATCH /api/users/status */
export const userStatusUpdateSchema = idListSchema.extend({
  status: z.enum(['active', 'inactive']),
})

export const userIdsSchema = idListSchema
export const deletedCountSchema = z.object({ deletedCount: z.number().int() })
export const updatedCountSchema = z.object({ updatedCount: z.number().int() })
export const invitedCountSchema = z.object({ invitedCount: z.number().int() })
