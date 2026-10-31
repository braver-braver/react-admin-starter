import { uploadFileSchema } from '@/contract/uploads'
import { apiRequest } from '@/lib/api'

/**
 * 文件上传的共享原语：上传后用返回的 url 预览（如 <img src={url} />）。
 * 响应 schema 与类型在 `@/contract/uploads`。
 */
export function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest('/uploads', uploadFileSchema, {
    method: 'POST',
    body: form,
  })
}
