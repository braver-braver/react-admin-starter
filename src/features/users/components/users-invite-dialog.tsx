import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MailPlus, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { inviteUser } from '../api'
import { roles } from '../data/data'
import { usersQueryKey } from '../queries'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? '请输入受邀邮箱。' : undefined),
  }),
  role: z.string().min(1, '请选择角色。'),
  desc: z.string().optional(),
})

type UserInviteForm = z.infer<typeof formSchema>

type UserInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersInviteDialog({
  open,
  onOpenChange,
}: UserInviteDialogProps) {
  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: '', desc: '' },
  })
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (values: UserInviteForm) =>
      inviteUser({
        email: values.email,
        role: values.role,
        desc: values.desc || undefined,
      }),
    onSuccess: () => {
      toast.success('邀请已发送。')
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '邀请失败，请稍后重试。'
      )
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <MailPlus /> 邀请用户
          </DialogTitle>
          <DialogDescription>
            向新成员发送邮件邀请，加入后按所选角色获得对应权限。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-invite-form'
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='例如：zhang.wei@example.com'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='请选择角色'
                    items={roles.map(({ label, value }) => ({
                      label,
                      value,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='desc'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注（可选）</FormLabel>
                  <FormControl>
                    <Textarea
                      className='resize-none'
                      placeholder='随邀请附上一句话（可选）'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>取消</Button>
          </DialogClose>
          <Button
            type='submit'
            form='user-invite-form'
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Send />
            )}
            发送邀请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
