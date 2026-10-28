import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { authApi } from '@/features/auth/api'

export function Permissions() {
  const account = useAuthStore((state) => state.auth.user)
  const query = useQuery({
    queryKey: ['auth', account?.id, 'permissions'],
    queryFn: ({ signal }) => authApi.permissions(signal),
  })
  return (
    <>
      <Header>
        <span className='me-auto font-medium'>权限示例</span>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>当前账户权限</h1>
          <p className='mt-2 text-muted-foreground'>
            此页面从 API 读取权限，演示路由、菜单与按钮的权限控制。
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{account?.name}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {query.isPending && <p role='status'>正在读取权限…</p>}
            {query.isError && <p role='alert'>{query.error.message}</p>}
            {query.data && (
              <>
                <p>角色：{query.data.roles.join('、')}</p>
                <ul className='list-inside list-disc'>
                  {query.data.permissions.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </>
            )}
            <Button
              variant='outline'
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              重新读取权限
            </Button>
          </CardContent>
        </Card>
        <p className='text-sm text-muted-foreground'>
          前端检查仅改善交互；每个受保护 API
          必须由服务端检查当前会话与权限。开发时可清除模拟会话
          Cookie，再读取权限，验证 401 跳转。
        </p>
      </Main>
    </>
  )
}
