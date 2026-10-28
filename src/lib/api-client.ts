import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 与后端实现无关的共享 HTTP 客户端。
 *
 * - 基地址通过 VITE_API_BASE_URL 配置，默认 '/api'；
 * - 自动附带当前访问令牌；
 * - 错误统一交给 handleServerError / 路由层的 401/403 逻辑处理，
 *   不在此处绑定任何特定后端的响应语义。
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState().auth
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

/** 错误响应体的宽松契约：兼容 RFC 7807 problem json 与常见 { message } 结构。 */
interface ApiErrorBody {
  title?: string
  detail?: string
  message?: string
}

/** 从未知错误中提取 HTTP 状态码，非 HTTP 错误返回 0。 */
export function getErrorStatus(error: unknown): number {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? 0
  }
  if (error && typeof error === 'object' && 'status' in error) {
    return Number(error.status) || 0
  }
  return 0
}

/** 从未知错误中提取后端可读的错误信息（problem json 的 title/message），找不到返回 undefined。 */
export function getApiErrorMessage(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined
    return data?.title || data?.message || undefined
  }
  // 普通 Error 的 message 可能是技术性信息，不直接展示给用户
  return undefined
}
