import { apiClient, getApiErrorMessage, getErrorStatus } from '@/lib/api-client'
import {
  SessionUserSchema,
  SignInResponseSchema,
  type SessionUser,
  type SignInPayload,
  type SignInResponse,
} from './schemas'

/**
 * 认证相关 API。所有响应都经过 zod 校验后再返回，
 * 保证组件拿到的是契约内的数据。
 */

const SIGN_IN_FALLBACK_MESSAGE = '登录失败，请稍后重试。'

export async function signIn(payload: SignInPayload): Promise<SignInResponse> {
  try {
    const { data } = await apiClient.post('/auth/sign-in', payload)
    return SignInResponseSchema.parse(data)
  } catch (error) {
    if (getErrorStatus(error) > 0) {
      throw new Error(getApiErrorMessage(error) ?? SIGN_IN_FALLBACK_MESSAGE, {
        cause: error,
      })
    }
    throw new Error('无法连接登录服务，请检查网络后重试。', { cause: error })
  }
}

export async function fetchSession(): Promise<SessionUser> {
  const { data } = await apiClient.get('/auth/session')
  const parsed = SessionUserSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error('会话数据格式不正确。')
  }
  return parsed.data
}

export async function signOut(): Promise<void> {
  try {
    await apiClient.post('/auth/sign-out')
  } catch {
    // 登出是尽力而为：本地凭证始终会被清理，接口失败不阻断退出流程。
  }
}
