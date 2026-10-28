import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱。').pipe(z.email('请输入有效邮箱。')),
  password: z.string().min(1, '请输入密码。'),
})

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  dataScopes: z
    .record(
      z.string(),
      z.object({
        all: z.boolean(),
        self: z.boolean(),
        departments: z.array(z.string()),
      })
    )
    .optional(),
  routes: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  dataScope: z
    .object({
      all: z.boolean(),
      self: z.boolean(),
      departments: z.array(z.string()),
    })
    .optional(),
})
export const sessionSchema = z.object({
  user: authUserSchema,
  csrfToken: z.string().min(1),
})
export type AuthUser = z.infer<typeof authUserSchema>
export type Session = z.infer<typeof sessionSchema>
export type LoginInput = z.infer<typeof loginSchema>
