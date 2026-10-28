import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { appConfig } from '@/config/app'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError) {
          if (error.response?.status === 304) {
            toast.error('内容未发生变化')
          }
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          toast.error('登录状态已过期')
          useAuthStore.getState().auth.reset()
          queryClient.clear()
          router.navigate({ to: '/sign-in' })
        }
        if (error.response?.status === 500) {
          toast.error('服务器内部错误')
          // Only navigate to error page in production to avoid disrupting HMR in development
          if (import.meta.env.PROD) {
            router.navigate({ to: '/500' })
          }
        }
        if (error.response?.status === 403) {
          toast.error('没有执行该操作的权限')
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Apply runtime branding; index.html holds the initial static fallback.
document.title = appConfig.name
document.documentElement.lang = appConfig.locale
document
  .querySelector('meta[name="description"]')
  ?.setAttribute('content', appConfig.description)

/**
 * 开发环境启动 MSW mock API。
 * 条件动态导入保证 msw 及 handlers 不会进入生产构建；
 * 设置 VITE_ENABLE_MSW=false 可在开发时直连真实后端。
 */
async function prepareMockApi(): Promise<void> {
  if (!import.meta.env.DEV) return
  if (import.meta.env.VITE_ENABLE_MSW === 'false') return
  const { worker } = await import('@/mocks/browser')
  // bypass：Vite 开发服务器还有 HMR 等非 API 请求，避免误报
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
}

function renderApp() {
  const rootElement = document.getElementById('root')!
  if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement)
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>
    )
  }
}

// mock API 就绪后再渲染，保证首屏的会话请求即被拦截
prepareMockApi().then(renderApp)
