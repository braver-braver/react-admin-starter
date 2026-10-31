import { z } from 'zod'
import { apiRequest } from '@/lib/api'
import { type SystemResource } from './catalog'
import {
  navigationSchema,
  optionsSchema,
  systemListSchema,
  systemRecordSchema,
} from './schema'

export const systemApi = {
  list: (resource: SystemResource, page: number, search: string) =>
    apiRequest(
      `/system/${resource}?${new URLSearchParams({ page: String(page), pageSize: '10', search })}`,
      systemListSchema
    ),
  options: () => apiRequest('/system/options', optionsSchema),
  navigation: () => apiRequest('/auth/navigation', navigationSchema),
  save: (resource: SystemResource, id: string | undefined, body: unknown) =>
    apiRequest(
      id ? `/system/${resource}/${id}` : `/system/${resource}`,
      systemRecordSchema,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }
    ),
  remove: (resource: SystemResource, id: string) =>
    apiRequest(
      `/system/${resource}/${id}`,
      z.object({ success: z.literal(true) }),
      { method: 'DELETE' }
    ),
}
