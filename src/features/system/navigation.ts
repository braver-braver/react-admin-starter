import { createContext, useContext } from 'react'
import {
  FolderCog,
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Network,
  Contact,
  KeyRound,
  ListTree,
} from 'lucide-react'
import { type Permission } from '@/lib/permissions'
import { type NavGroup } from '@/components/layout/types'
import { routeCatalog } from './catalog'
import { type Menu } from './schema'

export const NavigationContext = createContext<NavGroup[]>([])
export const useNavigation = () => useContext(NavigationContext)
const icons = {
  dashboard: LayoutDashboard,
  users: Users,
  'current-permissions': ShieldCheck,
  audit: ScrollText,
  'system-accounts': Contact,
  'system-roles': ShieldCheck,
  'system-permissions': KeyRound,
  'system-menus': ListTree,
  'system-departments': Network,
}
export function navigationGroups(menus: Menu[]): NavGroup[] {
  const parents = [
    { id: '', name: '工作区' },
    ...menus.filter((menu) => menu.kind === 'directory'),
  ]
  return parents
    .map((parent) => ({
      title: parent.name,
      items: menus
        .filter((menu) => menu.kind === 'page' && menu.parentId === parent.id)
        .flatMap((menu) => {
          const route = routeCatalog.find((entry) => entry.id === menu.routeId)
          return route
            ? [
                {
                  title: menu.name,
                  url: route.path,
                  permission: (route.permission || undefined) as
                    | Permission
                    | undefined,
                  icon: icons[route.id as keyof typeof icons] ?? FolderCog,
                },
              ]
            : []
        }),
    }))
    .filter((group) => group.items.length > 0)
}
