import { uploadFileSchema } from '@/contract/uploads'
import { apiRequest } from '@/lib/api'

/**
 * 文件上传的共享原语：类型化契约 + 上传函数。
 * 预览直接使用返回的 url（如 <img src={url} />）。
 */
export { uploadFileSchema, type UploadedFile } from '@/contract/uploads'

export function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest('/uploads', uploadFileSchema, {
    method: 'POST',
    body: form,
  })
}
