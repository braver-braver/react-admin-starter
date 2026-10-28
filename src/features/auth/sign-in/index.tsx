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
    __DEMO_BUILD__ ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS !== 'false')
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录管理端</CardTitle>
          <CardDescription>
            {mocksEnabled
              ? '演示环境：使用下方账户体验不同权限。'
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
              <p>
                仅供演示，数据保存在当前浏览器；请勿输入真实密码或个人信息。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
