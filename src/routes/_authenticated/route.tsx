import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { sessionQueryOptions } from '@/features/auth/queries'

/**
 * 受保护路由的 UX 守卫：无令牌或会话校验失败时回到登录页。
 * 真正的授权始终由服务端执行，这里只负责界面引导。
 * 登录成功后统一进入首页，不携带任何动态回跳地址。
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.accessToken) {
      throw redirect({ to: '/sign-in' })
    }

    try {
      const user =
        await context.queryClient.ensureQueryData(sessionQueryOptions)
      // 会话以服务端返回为准，同步回本地状态供界面与按钮守卫使用
      if (useAuthStore.getState().auth.user !== user) {
        useAuthStore.getState().auth.setUser(user)
      }
    } catch {
      useAuthStore.getState().auth.reset()
      context.queryClient.clear()
      throw redirect({ to: '/sign-in' })
    }
  },
  component: AuthenticatedLayout,
})
