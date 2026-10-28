import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Plus, Pencil, Trash2, RefreshCw, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { canAccessData } from '@/lib/data-scope'
import { can } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { loadSession } from '@/features/auth/session'
import { systemApi } from './api'
import {
  apiCatalog,
  resourceNames,
  routeCatalog,
  scopeNames,
  type SystemResource,
} from './catalog'
import {
  accountInput,
  roleInput,
  permissionInput,
  menuInput,
  departmentInput,
  type SystemRecord,
} from './schema'

type Draft = {
  name: string
  email: string
  code: string
  password: string
  description: string
  enabled: boolean
  visible: boolean
  departmentId: string
  parentId: string
  roleIds: string[]
  permissionIds: string[]
  menuIds: string[]
  departmentIds: string[]
  scope: keyof typeof scopeNames
  kind: 'directory' | 'page'
  routeId: string
  order: number
}
const descriptions = {
  accounts:
    '管理可登录系统的账号、所属部门及角色，停用与密码重置会阻止旧会话继续使用。',
  roles: '组合页面入口、操作权限和数据范围。多个角色的有效授权取并集。',
  permissions: '统一维护权限代码；页面、按钮与 API 以同一能力代码进行检查。',
  menus:
    '配置导航目录、页面入口及顺序。隐藏菜单保留路由，停用菜单同时撤销该页面的路由访问。',
  departments: '维护组织层级，作为本部门、下级部门及指定部门数据范围的依据。',
}
function initial(record?: SystemRecord): Draft {
  return {
    name: '',
    email: '',
    code: '',
    password: '',
    description: '',
    enabled: true,
    visible: true,
    departmentId: '',
    parentId: '',
    roleIds: [],
    permissionIds: [],
    menuIds: [],
    departmentIds: [],
    scope: 'department',
    kind: 'page',
    routeId: '',
    order: 10,
    ...record,
  }
}
function payload(resource: SystemResource, draft: Draft) {
  switch (resource) {
    case 'accounts':
      return accountInput.safeParse({
        name: draft.name,
        email: draft.email,
        enabled: draft.enabled,
        departmentId: draft.departmentId,
        roleIds: draft.roleIds,
        ...(draft.password ? { password: draft.password } : {}),
      })
    case 'roles':
      return roleInput.safeParse({
        name: draft.name,
        code: draft.code,
        enabled: draft.enabled,
        permissionIds: draft.permissionIds,
        menuIds: draft.menuIds,
        scope: draft.scope,
        departmentIds: draft.scope === 'custom' ? draft.departmentIds : [],
      })
    case 'permissions':
      return permissionInput.safeParse({
        name: draft.name,
        code: draft.code,
        description: draft.description,
      })
    case 'menus':
      return menuInput.safeParse({
        name: draft.name,
        parentId: draft.parentId,
        kind: draft.kind,
        routeId: draft.kind === 'directory' ? '' : draft.routeId,
        enabled: draft.enabled,
        visible: draft.visible,
        order: draft.order,
      })
    case 'departments':
      return departmentInput.safeParse({
        name: draft.name,
        code: draft.code,
        parentId: draft.parentId,
        enabled: draft.enabled,
      })
  }
}
export function SystemPage({ resource }: { resource: SystemResource }) {
  const user = useAuthStore((state) => state.auth.user)
  const queryClient = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<SystemRecord | 'new' | null>(null)
  const [deleting, setDeleting] = useState<SystemRecord | null>(null)
  const query = useQuery({
    queryKey: ['system', resource, user?.id, user?.dataScopes, search, page],
    queryFn: () => systemApi.list(resource, page, search),
  })
  const options = useQuery({
    queryKey: ['system-options', user?.id, user?.dataScope],
    queryFn: systemApi.options,
  })
  const writable =
    can(user, `system:${resource}:write`) &&
    (resource === 'accounts' ||
      !!user?.dataScopes?.[`system:${resource}:write`]?.all)
  const refreshed = async () => {
    await loadSession()
    await queryClient.invalidateQueries()
    await router.invalidate()
  }
  const deletion = useMutation({
    mutationFn: (id: string) => systemApi.remove(resource, id),
    onSuccess: async () => {
      setDeleting(null)
      toast.success('记录已删除。')
      await refreshed()
    },
  })
  const canWriteRecord = (record: SystemRecord) =>
    writable &&
    !record.protected &&
    (record.resource !== 'accounts' ||
      canAccessData(user, record, 'system:accounts:write'))
  const records = query.data?.items ?? []
  const all = options.data?.items ?? []
  const label = (id: string) => all.find((item) => item.id === id)?.name ?? id
  const details = (record: SystemRecord) => {
    switch (record.resource) {
      case 'accounts':
        return (
          <>
            <p>{record.email}</p>
            <p className='text-xs text-muted-foreground'>
              {label(record.departmentId)} ·{' '}
              {record.roleIds.map(label).join('、')}
            </p>
          </>
        )
      case 'roles':
        return (
          <>
            <p>
              {record.code} · {scopeNames[record.scope]}
            </p>
            <p className='text-xs text-muted-foreground'>
              {record.permissionIds.length} 项能力 · {record.menuIds.length}{' '}
              个菜单授权
            </p>
          </>
        )
      case 'permissions':
        return (
          <>
            <code className='text-xs'>{record.code}</code>
            <p className='text-xs text-muted-foreground'>
              {apiCatalog
                .filter((api) => api.permission === record.code)
                .map((api) => `${api.method} ${api.path}`)
                .join('；') ||
                record.description ||
                '自定义能力'}
            </p>
          </>
        )
      case 'menus':
        return (
          <>
            <p>
              {record.kind === 'directory'
                ? '目录'
                : routeCatalog.find((route) => route.id === record.routeId)
                    ?.path}
            </p>
            <p className='text-xs text-muted-foreground'>
              {record.parentId ? label(record.parentId) : '根层'} · 排序{' '}
              {record.order} · {record.visible ? '导航显示' : '导航隐藏'}
            </p>
          </>
        )
      case 'departments':
        return (
          <>
            <p>{record.code}</p>
            <p className='text-xs text-muted-foreground'>
              上级：{record.parentId ? label(record.parentId) : '无'}
            </p>
          </>
        )
    }
  }
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='max-w-2xl space-y-2'>
            <p className='text-sm text-muted-foreground'>系统管理</p>
            <h1 className='text-2xl font-semibold'>
              {resourceNames[resource]}管理
            </h1>
            <p className='text-sm leading-6 text-muted-foreground'>
              {descriptions[resource]}
            </p>
          </div>
          {writable &&
            (resource !== 'accounts' ||
              user?.dataScopes?.['system:accounts:write']?.all ||
              !!user?.dataScopes?.['system:accounts:write']?.departments
                .length) && (
              <Button onClick={() => setEditor('new')} disabled={!options.data}>
                <Plus />
                新增{resourceNames[resource]}
              </Button>
            )}
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Input
            aria-label={`搜索${resourceNames[resource]}`}
            placeholder='搜索名称、邮箱或代码'
            className='w-full sm:max-w-sm'
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <span className='text-sm text-muted-foreground tabular-nums'>
            共 {query.data?.total ?? 0} 条
          </span>
          <Button
            variant='ghost'
            size='icon'
            aria-label='刷新列表'
            onClick={() => void query.refetch()}
          >
            <RefreshCw className='size-4' />
          </Button>
        </div>
        {(query.isError || options.isError) && (
          <div role='alert' className='space-y-2 text-sm text-destructive'>
            <p>{query.error?.message ?? options.error?.message}</p>
            <Button
              variant='outline'
              onClick={() => {
                void query.refetch()
                void options.refetch()
              }}
            >
              重试
            </Button>
          </div>
        )}
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>配置信息</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className='text-end'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending && (
                <TableRow>
                  <TableCell colSpan={4} role='status'>
                    正在加载…
                  </TableCell>
                </TableRow>
              )}
              {!query.isPending && !records.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='h-24 text-center text-muted-foreground'
                  >
                    没有匹配的记录。
                  </TableCell>
                </TableRow>
              )}
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className='min-w-36 font-medium'>
                    {record.name}
                    {record.protected && (
                      <span className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
                        <LockKeyhole className='size-3' />
                        内置保护
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='max-w-lg min-w-56 break-words whitespace-normal'>
                    {details(record)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        'enabled' in record && !record.enabled
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {'enabled' in record
                        ? record.enabled
                          ? '启用'
                          : '停用'
                        : '已注册'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setEditor(record)}
                        aria-label={`${canWriteRecord(record) ? '编辑' : '查看'}${record.name}`}
                      >
                        <Pencil className='size-3.5' />
                        {canWriteRecord(record) ? '编辑' : '查看'}
                      </Button>
                      {canWriteRecord(record) && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='text-destructive'
                            disabled={record.protected}
                            aria-label={`删除${record.name}`}
                            onClick={() => setDeleting(record)}
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className='flex items-center justify-end gap-3'>
          <Button
            variant='outline'
            size='sm'
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className='text-sm tabular-nums'>
            第 {page} / {Math.max(1, Math.ceil((query.data?.total ?? 0) / 10))}{' '}
            页
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page * 10 >= (query.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
        {editor && (
          <SystemEditor
            key={editor === 'new' ? `new-${resource}` : editor.id}
            resource={resource}
            record={editor === 'new' ? undefined : editor}
            options={all}
            readOnly={!writable || (editor !== 'new' && !canWriteRecord(editor))}
            onClose={() => setEditor(null)}
            onSaved={refreshed}
          />
        )}
        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          title={`删除${resourceNames[resource]}`}
          desc={`确认删除“${deleting?.name ?? ''}”？有关联记录时将拒绝删除。`}
          confirmText='删除'
          destructive
          isLoading={deletion.isPending}
          handleConfirm={() => {
            if (deleting) deletion.mutate(deleting.id)
          }}
        />
      </Main>
    </>
  )
}
function SystemEditor({
  resource,
  record,
  options,
  readOnly,
  onClose,
  onSaved,
}: {
  resource: SystemResource
  record?: SystemRecord
  options: SystemRecord[]
  readOnly: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState(() => initial(record))
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: (body: unknown) => systemApi.save(resource, record?.id, body),
    onSuccess: async () => {
      onClose()
      toast.success('配置已保存。')
      await onSaved()
    },
    onError: (failure) => setError(failure.message),
  })
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((state) => ({ ...state, [key]: value }))
  const text = (
    key: 'name' | 'code' | 'email' | 'password' | 'description',
    label: string,
    type = 'text'
  ) => (
    <label className='grid gap-2 text-sm'>
      {label}
      <Input
        type={type}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        value={draft[key]}
        onChange={(event) => set(key, event.target.value)}
        required={key !== 'description' && (key !== 'password' || !record)}
      />
    </label>
  )
  const select = <
    K extends 'scope' | 'departmentId' | 'parentId' | 'kind' | 'routeId',
  >(
    key: K,
    label: string,
    items: { id: string; name: string }[]
  ) => (
    <label className='grid gap-2 text-sm'>
      {label}
      <select
        aria-label={label}
        className='h-10 w-full rounded-md border bg-background px-3'
        value={draft[key]}
        onChange={(event) => set(key, event.target.value as Draft[K])}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
  const toggle = (key: 'enabled' | 'visible', label: string) => (
    <label className='flex min-h-10 items-center gap-2 text-sm'>
      <input
        type='checkbox'
        checked={draft[key]}
        onChange={(event) => set(key, event.target.checked)}
      />
      {label}
    </label>
  )
  const choices = (
    key: 'roleIds' | 'permissionIds' | 'menuIds' | 'departmentIds',
    label: string,
    items: SystemRecord[]
  ) => (
    <fieldset className='space-y-2 rounded-md border p-3'>
      <legend className='px-1 text-sm font-medium'>{label}</legend>
      <div className='grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2'>
        {items.map((item) => (
          <label
            key={item.id}
            className='flex min-h-10 items-start gap-2 py-2 text-sm'
          >
            <input
              type='checkbox'
              className='mt-1'
              checked={draft[key].includes(item.id)}
              onChange={(event) =>
                set(
                  key,
                  event.target.checked
                    ? [...draft[key], item.id]
                    : draft[key].filter((id) => id !== item.id)
                )
              }
            />
            <span>
              {item.name}
              {'code' in item && (
                <code className='block text-xs text-muted-foreground'>
                  {item.code}
                </code>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
  const departments = options.filter(
    (item) => item.resource === 'departments' && item.id !== record?.id
  )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent className='flex max-h-[90svh] flex-col sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {readOnly ? '查看' : record ? '编辑' : '新增'}
            {resourceNames[resource]}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? '内置保护或只读记录。'
              : '保存后更新会话授权、导航与数据范围。'}
          </DialogDescription>
        </DialogHeader>
        <form
          id='system-editor'
          className='min-h-0 space-y-4 overflow-y-auto px-1'
          onSubmit={(event) => {
            event.preventDefault()
            setError('')
            const parsed = payload(resource, draft)
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? '请检查输入。')
              return
            }
            mutation.mutate(parsed.data)
          }}
        >
          <fieldset
            disabled={readOnly || mutation.isPending}
            className='space-y-4'
          >
            {text('name', resource === 'accounts' ? '显示名称' : '名称')}
            {resource === 'accounts' && (
              <>
                {text('email', '登录邮箱', 'email')}
                {text(
                  'password',
                  record ? '重置密码（留空则保留）' : '初始密码',
                  'password'
                )}
                {select('departmentId', '所属部门', [
                  { id: '', name: '请选择部门' },
                  ...departments,
                ])}
                {choices(
                  'roleIds',
                  '角色分配',
                  options.filter(
                    (item) => item.resource === 'roles' && item.id !== 'admin'
                  )
                )}
              </>
            )}
            {(resource === 'roles' ||
              resource === 'permissions' ||
              resource === 'departments') &&
              text('code', '唯一代码')}
            {resource === 'roles' && (
              <>
                {select(
                  'scope',
                  '数据范围',
                  Object.entries(scopeNames).map(([id, name]) => ({ id, name }))
                )}
                {draft.scope === 'custom' &&
                  choices('departmentIds', '指定数据部门', departments)}
                {choices(
                  'permissionIds',
                  '页面 / 按钮 / API 能力',
                  options.filter((item) => item.resource === 'permissions')
                )}
                <p className='text-xs text-muted-foreground'>
                  页面需同时具备菜单授权和对应查看权限。隐藏入口不能替代接口鉴权。
                </p>
                {choices(
                  'menuIds',
                  '可访问页面',
                  options.filter(
                    (item) => item.resource === 'menus' && item.kind === 'page'
                  )
                )}
              </>
            )}
            {resource === 'permissions' && text('description', '说明')}
            {resource === 'departments' &&
              select('parentId', '上级部门', [
                { id: '', name: '请选择上级部门' },
                ...departments,
              ])}
            {resource === 'menus' && (
              <>
                {select('kind', '菜单类型', [
                  { id: 'directory', name: '目录' },
                  { id: 'page', name: '页面' },
                ])}
                {select('parentId', '上级目录', [
                  { id: '', name: '根层' },
                  ...options.filter(
                    (item) =>
                      item.resource === 'menus' &&
                      item.kind === 'directory' &&
                      item.id !== record?.id
                  ),
                ])}
                {draft.kind === 'page' &&
                  select('routeId', '绑定页面', [
                    { id: '', name: '请选择页面' },
                    ...routeCatalog.map((route) => ({
                      id: route.id,
                      name: `${route.name} (${route.path})`,
                    })),
                  ])}
                <label className='grid gap-2 text-sm'>
                  显示顺序
                  <Input
                    type='number'
                    min={0}
                    max={9999}
                    value={draft.order}
                    onChange={(event) =>
                      set('order', Number(event.target.value))
                    }
                  />
                </label>
                {toggle('visible', '在导航中显示')}
              </>
            )}
            {resource !== 'permissions' && toggle('enabled', '启用')}
          </fieldset>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={onClose}
            disabled={mutation.isPending}
          >
            关闭
          </Button>
          {!readOnly && (
            <Button
              type='submit'
              form='system-editor'
              disabled={mutation.isPending}
            >
              保存配置
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
