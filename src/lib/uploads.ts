import { z } from 'zod'
import { apiRequest } from '@/lib/api'

/**
 * 文件上传的共享原语：类型化契约 + 上传函数。
 * 预览直接使用返回的 url（如 <img src={url} />）。
 */
export const uploadFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  contentType: z.string(),
  size: z.number(),
})
export type UploadedFile = z.infer<typeof uploadFileSchema>

export function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest('/api/uploads', uploadFileSchema, {
    method: 'POST',
    body: form,
  })
}
