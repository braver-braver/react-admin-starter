import { z } from 'zod'
import { systemResources } from './permissions.ts'

export const resourceSchema = z.enum(systemResources)
const id = z.string().min(1).max(100)
const name = z
  .string()
  .trim()
  .min(1, '请输入名称。')
  .max(80, '名称最多 80 字。')
const code = z
  .string()
  .regex(
    /^[a-z][a-z0-9:_-]{1,79}$/,
    '代码使用小写字母、数字、冒号、下划线或连字符。'
  )
const ids = z
  .array(id)
  .max(200)
  .refine((items) => new Set(items).size === items.length, '不能重复选择。')
const scopeSchema = z.enum([
  'all',
  'department',
  'descendants',
  'self',
  'custom',
])
export const accountInput = z
  .object({
    name,
    email: z
      .email('请输入有效邮箱。')
      .transform((value) => value.toLowerCase()),
    enabled: z.boolean(),
    departmentId: id,
    roleIds: ids.min(1, '至少选择一个角色。'),
    password: z.string().min(8, '密码至少 8 位。').max(128).optional(),
  })
  .strict()
export const roleInput = z
  .object({
    name,
    code,
    enabled: z.boolean(),
    permissionIds: ids,
    menuIds: ids,
    scope: scopeSchema,
    departmentIds: ids,
  })
  .strict()
  .refine(
    (value) => value.scope !== 'custom' || value.departmentIds.length > 0,
    { message: '请选择数据范围部门。', path: ['departmentIds'] }
  )
export const permissionInput = z
  .object({ name, code, description: z.string().trim().max(200) })
  .strict()
export const menuInput = z
  .object({
    name,
    parentId: z.string().max(100),
    kind: z.enum(['directory', 'page']),
    routeId: z.string().max(100),
    enabled: z.boolean(),
    visible: z.boolean(),
    order: z.number().int().min(0).max(9999),
  })
  .strict()
export const departmentInput = z
  .object({ name, code, parentId: z.string().max(100), enabled: z.boolean() })
  .strict()
const common = { id, protected: z.boolean() }
export const accountSchema = accountInput
  .omit({ password: true })
  .extend({ ...common, resource: z.literal('accounts') })
export const roleSchema = roleInput.safeExtend({
  ...common,
  resource: z.literal('roles'),
})
export const permissionSchema = permissionInput.extend({
  ...common,
  resource: z.literal('permissions'),
})
export const menuSchema = menuInput.extend({
  ...common,
  resource: z.literal('menus'),
})
export const departmentSchema = departmentInput.extend({
  ...common,
  resource: z.literal('departments'),
})
export const systemRecordSchema = z.discriminatedUnion('resource', [
  accountSchema,
  roleSchema,
  permissionSchema,
  menuSchema,
  departmentSchema,
])
export type SystemRecord = z.infer<typeof systemRecordSchema>
export type Account = z.infer<typeof accountSchema>
export type Role = z.infer<typeof roleSchema>
export type Menu = z.infer<typeof menuSchema>
export const navigationSchema = z.array(menuSchema)
export const systemListSchema = z.object({
  items: z.array(systemRecordSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
export const optionsSchema = z.object({ items: z.array(systemRecordSchema) })

/** Flat list envelope of GET /api/system/{resource}, narrowed to one resource. */
export const systemListOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  })
