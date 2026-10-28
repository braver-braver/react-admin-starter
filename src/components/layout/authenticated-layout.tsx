import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { systemApi } from '@/features/system/api'
import {
  NavigationContext,
  navigationGroups,
} from '@/features/system/navigation'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const user = useAuthStore((state) => state.auth.user)
  const navigation = useQuery({
    queryKey: ['navigation', user?.id, user?.routes, user?.permissions],
    queryFn: systemApi.navigation,
    enabled: !!user,
    staleTime: 0,
  })
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  if (!user) return null
  return (
    <NavigationContext value={navigationGroups(navigation.data ?? [])}>
      <SearchProvider>
        <LayoutProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />
            <AppSidebar />
            {navigation.isError && (
              <div role='alert' className='p-4 text-sm'>
                导航加载失败。
                <Button
                  variant='link'
                  onClick={() => void navigation.refetch()}
                >
                  重新加载导航
                </Button>
              </div>
            )}
            <SidebarInset
              className={cn(
                // Set content container, so we can use container queries
                '@container/content',

                // If layout is fixed, set the height
                // to 100svh to prevent overflow
                'has-data-[layout=fixed]:h-svh',

                // If layout is fixed and sidebar is inset,
                // set the height to 100svh - spacing (total margins) to prevent overflow
                'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
              )}
            >
              {children ?? <Outlet />}
            </SidebarInset>
          </SidebarProvider>
        </LayoutProvider>
      </SearchProvider>
    </NavigationContext>
  )
}
