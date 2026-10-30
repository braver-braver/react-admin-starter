import { z } from 'zod'

/** Body of every non-2xx response. `code` is a string so clients tolerate new codes. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/** Every successful response is wrapped as `{ data }`. */
export const successEnvelope = <T extends z.ZodType>(data: T) =>
  z.object({ data })

/** Result of a delete or logout. */
export const successSchema = z.object({ success: z.literal(true) })

/** Bulk operations identify their targets by id. */
export const idListSchema = z.object({ ids: z.array(z.string()) })

/** Pagination metadata of server-paged lists. */
export const pageMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPageCount: z.number(),
})
