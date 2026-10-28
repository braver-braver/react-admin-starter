import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AuditTable } from './components/audit-table'

const route = getRouteApi('/_authenticated/audit/')

export function AuditLogs() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>审计日志</h2>
          <p className='text-muted-foreground'>
            登录与用户变更的只读流水，仅管理员可查看（服务端校验）。
          </p>
        </div>
        <AuditTable search={search} navigate={navigate} />
      </Main>
    </>
  )
}
