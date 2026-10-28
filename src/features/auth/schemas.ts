import { z } from 'zod'

/**
 * 认证与授权的前端契约。
 *
 * 角色与权限的映射由服务端计算：登录/会话接口直接返回生效的
 * permissions 列表，前端只做展示与 UX 级守卫，不自行推导权限。
 */

export const RoleSchema = z.enum(['admin', 'operator', 'viewer'])
export type Role = z.infer<typeof RoleSchema>

export const PermissionSchema = z.enum([
  'dashboard:read',
  'users:read',
  'users:write',
  'audit:read',
])
export type Permission = z.infer<typeof PermissionSchema>

export const SessionUserSchema = z.object({
  accountNo: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  roles: z.array(RoleSchema),
  permissions: z.array(PermissionSchema),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const SignInPayloadSchema = z.object({
  email: z.email(),
  password: z.string().min(7),
})
export type SignInPayload = z.infer<typeof SignInPayloadSchema>

export const SignInResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: SessionUserSchema,
})
export type SignInResponse = z.infer<typeof SignInResponseSchema>
