import { z } from 'zod'
import {
  idListSchema,
  pageMetaSchema,
  pageSizeQuery,
  wireDate,
} from './common.ts'

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

// ---------------------------------------------------------------- requests

/** The only roles a user may hold. */
export const userRoleValues = [
  'superadmin',
  'admin',
  'manager',
  'cashier',
] as const

/** Columns the list can be sorted by. */
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
export type UserSortKey = (typeof userSortKeys)[number]
const isUserSortKey = (value: string): value is UserSortKey =>
  (userSortKeys as readonly string[]).includes(value)

/** Shown when a required field is missing or blank; reported before other messages. */
export const USER_FIELDS_REQUIRED = '请完整填写必填字段。'
const ROLE_NOT_ALLOWED = '角色不在允许范围内。'
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const requiredText = z
  .string({ error: USER_FIELDS_REQUIRED })
  .trim()
  .min(1, USER_FIELDS_REQUIRED)
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
const roleField = (message: string) =>
  z.enum(userRoleValues, {
    error: (issue) =>
      issue.input === undefined || issue.input === ''
        ? USER_FIELDS_REQUIRED
        : message,
  })

/** POST /api/users and PUT /api/users/{id}. Unknown fields are ignored. */
export const userWriteSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  username: requiredText,
  email: requiredText.regex(EMAIL_PATTERN, '邮箱格式不正确。').meta({
    format: 'email',
  }),
  phoneNumber: requiredText,
  role: roleField(ROLE_NOT_ALLOWED),
  password: z
    .string()
    .min(8, '密码至少需要 8 位字符。')
    .max(128)
    .optional()
    .meta({ description: 'Optional on update: omit to keep the current one.' }),
  departmentId: optionalText.meta({
    description:
      'Must be inside the actor users:write scope. Defaults to the actor department on create and is unchanged on update.',
  }),
  avatarUrl: optionalText,
})
export type UserWritePayload = z.input<typeof userWriteSchema>

const INVITE_EMAIL_INVALID = '请输入有效邮箱。'

/** POST /api/users/invite */
export const userInviteSchema = z.object({
  email: z
    .string({ error: INVITE_EMAIL_INVALID })
    .trim()
    .regex(EMAIL_PATTERN, INVITE_EMAIL_INVALID)
    .meta({ format: 'email' }),
  role: z.enum(userRoleValues, { error: ROLE_NOT_ALLOWED }),
  desc: z.string().optional(),
})
export type UserInvitePayload = z.input<typeof userInviteSchema>

/** PATCH /api/users/status */
export const userStatusUpdateSchema = idListSchema.extend({
  status: z.enum(['active', 'inactive'], {
    error: '状态只允许启用或停用。',
  }),
})
export type UserBulkStatus = z.infer<typeof userStatusUpdateSchema>['status']

/** Result counts of the bulk operations. */
export const deletedCountSchema = z.object({ deletedCount: z.number() })
export const updatedCountSchema = z.object({ updatedCount: z.number() })
export const invitedCountSchema = z.object({ invitedCount: z.number() })

/**
 * GET /api/users query string. Repeated keys carry arrays
 * (`status=active&status=invited`). An unknown `sortBy` falls back to
 * `username` rather than failing; `pageSize` above 100 is clamped to 100.
 */
export const usersQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: pageSizeQuery,
  username: z.string().optional().meta({
    description: 'Matches username, email, full name or phone number.',
  }),
  status: z.array(userStatusSchema).optional(),
  role: z.array(userRoleSchema).optional(),
  sortBy: z
    .string()
    .default('username')
    .transform(
      (value): UserSortKey => (isUserSortKey(value) ? value : 'username')
    )
    .meta({
      description: `One of ${userSortKeys.join(', ')}. Any other value falls back to username.`,
    }),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})
/** Client-side parameters: page and pageSize are always sent. */
export type UsersListParams = z.input<typeof usersQuerySchema> & {
  page: number
  pageSize: number
}
