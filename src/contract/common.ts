import { z } from 'zod'

/** Body of every non-2xx response. `code` is a string so clients tolerate new codes. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/**
 * Timestamps travel as ISO 8601 date-time strings (`2026-10-30T10:00:00Z`,
 * fractional seconds and `+hh:mm` offsets allowed) and are parsed into `Date`.
 * Anything else, including numbers, booleans and null, is rejected.
 */
export const wireDate = z.codec(z.iso.datetime({ offset: true }), z.date(), {
  decode: (value) => new Date(value),
  encode: (value) => value.toISOString(),
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
