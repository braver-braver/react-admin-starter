import { z } from 'zod'

/** Body of every non-2xx response. `code` is a string so clients tolerate new codes. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/** Result of a delete or logout. */
export const successSchema = z.object({ success: z.literal(true) })

/** Pagination metadata of server-paged lists. */
export const pageMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPageCount: z.number(),
})
