import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn, sleep } from '@/lib/utils'
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

const formSchema = z.object({
  email: z.email({
    error: (issue) => (issue.input === '' ? '请输入邮箱。' : undefined),
  }),
  password: z.string().min(1, '请输入密码。').min(7, '密码至少需要 7 位。'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    if (import.meta.env.PROD) {
      toast.error('演示登录仅在开发环境可用，请接入真实认证服务。')
      return
    }

    setIsLoading(true)
    toast.promise(sleep(150), {
      loading: '正在进入演示模式…',
      success: () => {
        setIsLoading(false)
        auth.setUser({
          accountNo: 'DEMO',
          email: data.email,
          role: ['demo'],
          exp: Date.now() + 60 * 60 * 1000,
        })
        auth.setAccessToken('mock-access-token')
        navigate({ to: redirectTo || '/', replace: true })
        return '已进入演示模式'
      },
      error: () => {
        setIsLoading(false)
        return '演示登录失败'
      },
    })
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
        <Button className='mt-2' disabled={isLoading || import.meta.env.PROD}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          演示登录
        </Button>
      </form>
    </Form>
  )
}
