import { z } from 'zod'

/** Result of POST /api/v1/uploads. */
export const uploadFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  contentType: z.string(),
  size: z.number(),
})
export type UploadedFile = z.infer<typeof uploadFileSchema>
