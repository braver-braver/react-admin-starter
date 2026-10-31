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

/** Largest page size a list returns; larger requests are clamped (decision D3). */
export const MAX_PAGE_SIZE = 100

/**
 * `pageSize` query parameter: values above the maximum are clamped, not
 * rejected, so the input JSON Schema deliberately carries no `maximum`.
 */
export const pageSizeQuery = z
  .number()
  .int()
  .min(1)
  .default(10)
  .transform((value) => Math.min(value, MAX_PAGE_SIZE))
  .meta({
    description: `Values above ${MAX_PAGE_SIZE} are clamped to ${MAX_PAGE_SIZE}; the response meta reports the effective pageSize.`,
  })

/** Pagination metadata of server-paged lists. */
export const pageMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPageCount: z.number(),
})

/**
 * The one envelope of every paged list: `{ items, meta }`. Tolerant of extra
 * fields, like all responses.
 */
export const listEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), meta: pageMetaSchema })
