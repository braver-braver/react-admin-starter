import { Link } from '@tanstack/react-router'
import { appConfig } from '@/config/app'
import { ArrowUpRight, BookOpen, Palette, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Dashboard() {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-6 space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>工作台</h1>
          <p className='text-muted-foreground'>{appConfig.tagline}</p>
        </div>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          <Card>
            <CardHeader>
              <BookOpen className='size-5 text-muted-foreground' />
              <CardTitle>工程基座</CardTitle>
              <CardDescription>
                React 19、Vite、TanStack 与 shadcn/ui
              </CardDescription>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              保留可复用的布局、路由、表格和主题能力，不绑定特定 Go 后端。
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Users className='size-5 text-muted-foreground' />
              <CardTitle>用户管理示例</CardTitle>
              <CardDescription>
                表格、筛选、对话框和表单的组合示例
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to='/users'
                className='inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline'
              >
                查看示例 <ArrowUpRight className='size-4' />
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Palette className='size-5 text-muted-foreground' />
              <CardTitle>外观设置</CardTitle>
              <CardDescription>支持明暗主题及侧边栏布局切换</CardDescription>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              使用右上角的主题切换或设置按钮预览组件风格。
            </CardContent>
          </Card>
        </div>
        <p className='mt-6 text-sm text-muted-foreground'>
          当前为 UI 演示版本，用户数据和登录状态均非真实后端认证；后续将引入 MSW
          与 API 契约。
        </p>
      </Main>
    </>
  )
}
