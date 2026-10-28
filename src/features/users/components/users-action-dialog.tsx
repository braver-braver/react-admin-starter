import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
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
import { FileUpload } from '@/components/file-upload'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { createUser, updateUser } from '../api'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { usersQueryKey } from '../queries'

const formSchema = z
  .object({
    firstName: z.string().min(1, '请输入名字。'),
    lastName: z.string().min(1, '请输入姓氏。'),
    username: z.string().min(1, '请输入用户名。'),
    phoneNumber: z.string().min(1, '请输入电话号码。'),
    email: z.email({
      error: (iss) => (iss.input === '' ? '请输入邮箱。' : undefined),
    }),
    password: z.string().transform((pwd) => pwd.trim()),
    role: z.string().min(1, '请选择角色。'),
    confirmPassword: z.string().transform((pwd) => pwd.trim()),
    avatarUrl: z.string().optional(),
    isEdit: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password.length > 0
    },
    { message: '请输入密码。', path: ['password'] }
  )
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password.length >= 8
    },
    { message: '密码至少需要 8 位字符。', path: ['password'] }
  )
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return /[a-z]/.test(data.password)
    },
    { message: '密码需包含至少一个小写字母。', path: ['password'] }
  )
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return /\d/.test(data.password)
    },
    { message: '密码需包含至少一个数字。', path: ['password'] }
  )
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password === data.confirmPassword
    },
    { message: '两次输入的密码不一致。', path: ['confirmPassword'] }
  )
type UserForm = z.infer<typeof formSchema>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const isEdit = !!currentRow
  const queryClient = useQueryClient()

  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          ...currentRow,
          password: '',
          confirmPassword: '',
          avatarUrl: currentRow.avatarUrl ?? '',
          isEdit,
        }
      : {
          firstName: '',
          lastName: '',
          username: '',
          email: '',
          role: '',
          phoneNumber: '',
          password: '',
          confirmPassword: '',
          avatarUrl: '',
          isEdit,
        },
  })

  const mutation = useMutation({
    mutationFn: (values: UserForm) => {
      // 编辑时未填写密码则不提交密码字段
      const password =
        values.isEdit && !values.password ? undefined : values.password
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.username,
        email: values.email,
        phoneNumber: values.phoneNumber,
        role: values.role,
        password,
        avatarUrl: values.avatarUrl || undefined,
      }
      return isEdit && currentRow
        ? updateUser(currentRow.id, payload)
        : createUser(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? '用户已更新。' : '用户已创建。')
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : '保存失败，请稍后重试。'
      )
    },
  })

  const onSubmit = (values: UserForm) => {
    mutation.mutate(values)
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑用户' : '添加用户'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改用户资料，' : '创建新用户，'}
            完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='avatarUrl'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>头像</FormLabel>
                    <div className='col-span-4'>
                      <FileUpload
                        value={field.value || undefined}
                        onChange={(url) => field.onChange(url ?? '')}
                        maxSizeMb={2}
                      />
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>姓氏</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='张'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>名字</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='伟'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='username'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      用户名
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='zhang_wei'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='zhang.wei@example.com'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      电话号码
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='+8613800000000'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>角色</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='请选择角色'
                      className='col-span-4'
                      items={roles.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      {isEdit ? '新密码' : '密码'}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder={
                          isEdit
                            ? '留空则不修改'
                            : '至少 8 位，含小写字母和数字'
                        }
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      确认密码
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        disabled={!isPasswordTouched}
                        placeholder='再次输入密码'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form' disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
