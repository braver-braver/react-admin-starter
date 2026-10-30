import { apiRequest } from '@/lib/api'
import { uploadFileSchema } from '@/lib/contract-schemas'

export type { UploadedFile } from '@/lib/contract-schemas'

/**
 * 文件上传的共享原语：上传函数；响应契约见 contract-schemas。
 * 预览直接使用返回的 url（如 <img src={url} />）。
 */

export function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest('/api/uploads', uploadFileSchema, {
    method: 'POST',
    body: form,
  })
}
