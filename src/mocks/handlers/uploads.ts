import { HttpResponse, http } from 'msw'
import {
  apiError,
  currentSession,
  requireCsrf,
  requirePermission,
} from './auth'

/** 上传上限与前端 FileUpload 组件保持一致 */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

export const uploadsHandlers = [
  http.post('/api/uploads', async ({ request, cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'users:write') ?? requireCsrf(request, session)
    if (denied) return denied

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return apiError(422, 'FILE_REQUIRED', '请选择要上传的文件。')
    }
    if (!file.type.startsWith('image/')) {
      return apiError(422, 'UNSUPPORTED_FILE_TYPE', '仅支持图片文件。')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError(422, 'FILE_TOO_LARGE', '文件大小不能超过 2MB。')
    }

    // 演示环境用对象 URL 直接预览；真实服务应返回持久化地址。
    return HttpResponse.json({
      data: {
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
        contentType: file.type,
        size: file.size,
      },
    })
  }),
]
