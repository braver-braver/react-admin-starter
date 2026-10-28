import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const mocksEnabled =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS !== 'false'
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录管理端</CardTitle>
          <CardDescription>
            {mocksEnabled
              ? '开发演示：使用下方账户体验不同权限。'
              : '请输入账户信息，登录已接入的认证服务。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
          {mocksEnabled && (
            <div className='mt-4 space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground'>
              <p>管理员：admin@example.com</p>
              <p>只读用户：viewer@example.com</p>
              <p>受限访客：guest@example.com</p>
              <p>演示密码：Demo1234!</p>
              <p>仅用于本地开发，刷新可恢复当前标签页的模拟会话。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
