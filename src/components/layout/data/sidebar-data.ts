import { appConfig } from '@/config/app'
import { LayoutDashboard, ScrollText, Users, ShieldCheck } from 'lucide-react'
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
          permission: 'users:read',
          icon: Users,
        },
        {
          title: '权限示例',
          url: '/permissions',
          icon: ShieldCheck,
          permission: 'permissions:read',
        },
        {
          title: '审计日志',
          url: '/audit',
          permission: 'audit:read',
          icon: ScrollText,
        },
      ],
    },
  ],
}
