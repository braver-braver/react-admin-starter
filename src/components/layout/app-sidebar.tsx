import { useAuthStore } from '@/stores/auth-store'
import { can } from '@/lib/permissions'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useNavigation } from '@/features/system/navigation'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const navGroups = useNavigation()
  const { collapsible, variant } = useLayout()
  const account = useAuthStore((state) => state.auth.user)
  const user = account
    ? { name: account.name, email: account.email, avatar: '' }
    : sidebarData.user

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup
            key={group.title}
            {...group}
            items={group.items.filter(
              (item) => !item.permission || can(account, item.permission)
            )}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
