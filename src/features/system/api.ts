import { type z } from 'zod'
import { type OperationId } from '@/contract/operations'
import { callOperation, callOperationUnchecked } from '@/lib/api'
import { type SystemResource } from './catalog'
import { type systemListSchema, type systemRecordSchema } from './schema'

/** Registry operation ids per system resource (`listSystemAccounts`, …). */
const names = {
  accounts: 'Account',
  roles: 'Role',
  permissions: 'Permission',
  menus: 'Menu',
  departments: 'Department',
} as const satisfies Record<SystemResource, string>

/** The registry operation id for an action on a system resource. */
export const systemOperationId = (
  action: 'list' | 'create' | 'update' | 'delete',
  resource: SystemResource
) =>
  `${action}System${names[resource]}${action === 'list' ? 's' : ''}` as OperationId

/**
 * The system pages share one screen for five resources and validate the body
 * with each resource's form schema, so they pick the operation at runtime.
 * Responses are still checked against that operation's success schema.
 */
export const systemApi = {
  list: (resource: SystemResource, page: number, search: string) =>
    callOperationUnchecked(systemOperationId('list', resource), {
      query: { page, pageSize: 10, search },
    }) as Promise<z.infer<typeof systemListSchema>>,
  options: () => callOperation('getSystemOptions'),
  navigation: () => callOperation('getNavigation'),
  save: (resource: SystemResource, id: string | undefined, body: unknown) =>
    (id
      ? callOperationUnchecked(systemOperationId('update', resource), {
          params: { id },
          body,
        })
      : callOperationUnchecked(systemOperationId('create', resource), {
          body,
        })) as Promise<z.infer<typeof systemRecordSchema>>,
  remove: (resource: SystemResource, id: string) =>
    callOperationUnchecked(systemOperationId('delete', resource), {
      params: { id },
    }) as Promise<{ success: true }>,
}
