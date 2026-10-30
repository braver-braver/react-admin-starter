import { z } from 'zod'

/** Login form validation, with user-facing messages. */
export const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱。').pipe(z.email('请输入有效邮箱。')),
  password: z.string().min(1, '请输入密码。'),
})

/** What the server accepts for POST /api/auth/login. */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

/** Which records a capability may touch; see docs/system-management.md. */
export const dataScopeSchema = z.object({
  all: z.boolean(),
  self: z.boolean(),
  departments: z.array(z.string()),
})

/** GET /api/auth/permissions */
export const permissionsSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
})

export const authUserSchema = permissionsSchema.extend({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  /** Paths the account may open; unlisted routes are denied by the guard. */
  routes: z.array(z.string()),
  departmentId: z.string(),
  /** Scope per capability code. Operations must read the matching entry. */
  dataScopes: z.record(z.string(), dataScopeSchema),
  /** Summary only; never authorize an operation from this field. */
  dataScope: dataScopeSchema.optional(),
})
export const sessionSchema = z.object({
  user: authUserSchema,
  csrfToken: z.string().min(1),
})
export type AuthUser = z.infer<typeof authUserSchema>
export type Session = z.infer<typeof sessionSchema>
export type LoginInput = z.infer<typeof loginSchema>
