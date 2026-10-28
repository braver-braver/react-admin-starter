import { useState } from 'react'
import { z } from 'zod'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { signIn } from '../../api'

const formSchema = z.object({
  email: z.email({
    error: (issue) => (issue.input === '' ? '请输入邮箱。' : undefined),
  }),
  password: z.string().min(1, '请输入密码。').min(7, '密码至少需要 7 位。'),
})

type FormValues = z.infer<typeof formSchema>

/**
 * 开发环境展示的演示账号（与 src/mocks/data/accounts.ts 对应）。
 * 演示口令按「角色名首字母大写 + 123456」推导，属于公开信息。
 */
const demoAccounts = [
  { email: 'admin@example.com', role: 'admin', label: '管理员' },
  { email: 'operator@example.com', role: 'operator', label: '运营人员' },
  { email: 'viewer@example.com', role: 'viewer', label: '只读访客' },
] as const

function demoPassphrase(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1) + '123456'
}

function DemoAccountsHint({ form }: { form: UseFormReturn<FormValues> }) {
  return (
    <div className='rounded-md border border-dashed p-3 text-xs text-muted-foreground'>
      <p className='mb-2 font-medium text-foreground'>
        演示账号（点击自动填充）
      </p>
      <div className='flex flex-wrap gap-2'>
        {demoAccounts.map((account) => (
          <Button
            key={account.email}
            type='button'
            variant='secondary'
            size='sm'
            className='h-7 px-2 text-xs'
            onClick={() =>
              form.reset({
                email: account.email,
                password: demoPassphrase(account.role),
              })
            }
          >
            {account.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

type UserAuthFormProps = React.HTMLAttributes<HTMLFormElement>

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.auth.setSession)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: FormValues) {
    setIsLoading(true)
    try {
      const session = await signIn(data)
      setSession(session)
      toast.success(`欢迎回来，${session.user.name}`)
      navigate({ to: '/', replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '登录失败，请稍后重试。'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码</FormLabel>
              <FormControl>
                <PasswordInput placeholder='至少 7 位字符' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          登录
        </Button>
        {import.meta.env.DEV && <DemoAccountsHint form={form} />}
      </form>
    </Form>
  )
}
