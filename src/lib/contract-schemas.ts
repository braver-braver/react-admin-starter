import { z } from 'zod'

/**
 * Wire-level schemas shared by every feature. This module must stay free of
 * DOM, router and `@/` imports so the contract can be loaded in Node when
 * generating docs/api.openapi.yaml.
 */

/** Body of every non-2xx response. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/** Result of a delete or logout. */
export const successSchema = z.object({ success: z.literal(true) })

/** Bulk operations identify their targets by id. */
export const idListSchema = z.object({ ids: z.array(z.string()) })

/** Pagination metadata of server-paged lists. */
export const pageMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPageCount: z.number().int().min(1),
})

/** Result of POST /api/uploads. */
export const uploadFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  contentType: z.string(),
  size: z.number().int().min(0),
})
export type UploadedFile = z.infer<typeof uploadFileSchema>
