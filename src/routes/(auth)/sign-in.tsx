import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { SignIn } from '@/features/auth/sign-in'

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: () => {
    // 已持有令牌时直接进入应用；会话有效性由受保护路由统一校验
    if (useAuthStore.getState().auth.accessToken) {
      throw redirect({ to: '/' })
    }
  },
  component: SignIn,
})
