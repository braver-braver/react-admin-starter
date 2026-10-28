import { create } from 'zustand'
import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import { type SessionUser } from '@/features/auth/schemas'

const ACCESS_TOKEN_COOKIE = 'ras.access-token'

/**
 * 认证状态：令牌持久化在 cookie 中以便刷新后恢复会话，
 * 用户信息始终以 /auth/session 的返回为准（服务端校验）。
 * 令牌仅用于演示会话保持，不代表任何生产安全边界。
 */
interface AuthState {
  auth: {
    user: SessionUser | null
    accessToken: string
    setSession: (session: { accessToken: string; user: SessionUser }) => void
    setUser: (user: SessionUser | null) => void
    reset: () => void
  }
}

function readPersistedToken(): string {
  const cookie = getCookie(ACCESS_TOKEN_COOKIE)
  if (!cookie) return ''
  try {
    // 兼容旧版本以 JSON 字符串存储的令牌
    const parsed = JSON.parse(cookie)
    return typeof parsed === 'string' ? parsed : cookie
  } catch {
    return cookie
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    accessToken: readPersistedToken(),
    setSession: ({ accessToken, user }) =>
      set((state) => {
        setCookie(ACCESS_TOKEN_COOKIE, accessToken)
        return { ...state, auth: { ...state.auth, user, accessToken } }
      }),
    setUser: (user) =>
      set((state) => ({ ...state, auth: { ...state.auth, user } })),
    reset: () =>
      set((state) => {
        removeCookie(ACCESS_TOKEN_COOKIE)
        return {
          ...state,
          auth: { ...state.auth, user: null, accessToken: '' },
        }
      }),
  },
}))
