import { LayoutDashboard, Users } from 'lucide-react'
import { appConfig } from '@/config/app'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: appConfig.demoUser,
  navGroups: [
    {
      title: '工作区',
      items: [
        {
          title: '工作台',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: '示例模块',
      items: [
        {
          title: '用户管理',
          url: '/users',
          icon: Users,
        },
      ],
    },
  ],
}
