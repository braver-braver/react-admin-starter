import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱。').pipe(z.email('请输入有效邮箱。')),
  password: z.string().min(1, '请输入密码。'),
})

const dataScopeSchema = z.object({
  all: z.boolean(),
  self: z.boolean(),
  departments: z.array(z.string()),
})

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  dataScopes: z.record(z.string(), dataScopeSchema).optional(),
  routes: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  dataScope: dataScopeSchema.optional(),
})
export const sessionSchema = z.object({
  user: authUserSchema,
  csrfToken: z.string().min(1),
})
/** GET /api/v1/auth/permissions */
export const permissionsSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
})
export type AuthUser = z.infer<typeof authUserSchema>
export type Session = z.infer<typeof sessionSchema>
export type LoginInput = z.infer<typeof loginSchema>
