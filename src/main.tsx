import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { appConfig } from '@/config/app'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError, invalidateApiRequests, setAuthErrorHandler } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { clearSession, safeRedirect } from '@/features/auth/session'
import { DirectionProvider } from './context/direction-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(
          error instanceof ApiError &&
          error.status !== 0 &&
          error.status < 500
        ),
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: { onError: handleServerError },
  },
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

useAuthStore.subscribe((state, previous) => {
  if (JSON.stringify(state.auth.user) !== JSON.stringify(previous.auth.user)) {
    invalidateApiRequests()
    void queryClient.cancelQueries()
    queryClient.clear()
  }
})

setAuthErrorHandler((error) => {
  if (error.status === 401) {
    const target = safeRedirect(router.history.location.href)
    clearSession()
    toast.error('登录状态已过期，请重新登录。')
    void router.navigate({
      to: '/sign-in',
      search: { redirect: target },
      replace: true,
    })
  } else if (error.status === 403) {
    toast.error('当前账户没有相应权限。')
    void router.navigate({ to: '/403' })
  }
})

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  }
  renderApp()
}

// Apply runtime branding; index.html holds the initial static fallback.
document.title = appConfig.name
document.documentElement.lang = appConfig.locale
document
  .querySelector('meta[name="description"]')
  ?.setAttribute('content', appConfig.description)

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

void start().catch(() => {
  const root = document.getElementById('root')
  if (root) root.textContent = '应用初始化失败，请检查网络或开发服务后刷新。'
})
