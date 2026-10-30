import { z } from 'zod'
import { pageSizeQuery } from './common.ts'
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
/**
 * A list of record ids: at most 200, no duplicates. `refine` rules never reach
 * JSON Schema, so the uniqueness rule is also stated with `uniqueItems`.
 */
const uniqueIds = (min = 0, message?: string) =>
  (min > 0 ? z.array(id).min(min, message) : z.array(id))
    .max(200)
    .refine((items) => new Set(items).size === items.length, '不能重复选择。')
    .meta({ uniqueItems: true })
const ids = uniqueIds()
const scopeSchema = z.enum([
  'all',
  'department',
  'descendants',
  'self',
  'custom',
])
const password = z.string().min(8, '密码至少 8 位。').max(128).meta({
  description:
    'Initial or new password. Required to create an account; omit it on update to keep the current one.',
})
const email = z.email('请输入有效邮箱。').meta({
  description: 'Compared and stored in lower case; the server lowercases it.',
})

// Field shapes are shared by the request body (strict: unknown keys are
// rejected) and the response record (tolerant: a backend may add fields).
const accountFields = {
  name,
  email,
  enabled: z.boolean(),
  departmentId: id,
  roleIds: uniqueIds(1, '至少选择一个角色。'),
}
const roleFields = {
  name,
  code,
  enabled: z.boolean(),
  permissionIds: ids,
  menuIds: ids,
  scope: scopeSchema,
  departmentIds: ids,
}
const permissionFields = { name, code, description: z.string().trim().max(200) }
const menuFields = {
  name,
  parentId: z.string().max(100),
  kind: z.enum(['directory', 'page']),
  routeId: z.string().max(100),
  enabled: z.boolean(),
  visible: z.boolean(),
  order: z.number().int().min(0).max(9999),
}
const departmentFields = {
  name,
  code,
  parentId: z.string().max(100),
  enabled: z.boolean(),
}

/** Update body: the password is optional (omit to keep the current one). */
export const accountInput = z.strictObject({
  ...accountFields,
  email: email.transform((value) => value.toLowerCase()),
  password: password.optional(),
})
/** Create body: a new login account must be given an initial password. */
export const accountCreateInput = z.strictObject({
  ...accountFields,
  email: email.transform((value) => value.toLowerCase()),
  password,
})
export const roleInput = z
  .strictObject(roleFields)
  .refine(
    (value) => value.scope !== 'custom' || value.departmentIds.length > 0,
    { message: '请选择数据范围部门。', path: ['departmentIds'] }
  )
  .meta({
    description:
      'When `scope` is `custom`, `departmentIds` must contain at least one department; for other scopes it may be empty.',
  })
export const permissionInput = z.strictObject(permissionFields)
export const menuInput = z.strictObject(menuFields)
export const departmentInput = z.strictObject(departmentFields)

const common = { id, protected: z.boolean() }
export const accountSchema = z.object({
  ...accountFields,
  ...common,
  resource: z.literal('accounts'),
})
export const roleSchema = z.object({
  ...roleFields,
  ...common,
  resource: z.literal('roles'),
})
export const permissionSchema = z.object({
  ...permissionFields,
  ...common,
  resource: z.literal('permissions'),
})
export const menuSchema = z.object({
  ...menuFields,
  ...common,
  resource: z.literal('menus'),
})
export const departmentSchema = z.object({
  ...departmentFields,
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

/** GET /api/system/{resource} query string. `pageSize` above 100 is clamped to 100. */
export const systemListQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: pageSizeQuery,
  search: z.string().optional().meta({
    description: 'Case-insensitive match on the name and the code or email.',
  }),
})
