import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { UsersInviteDialog } from './users-invite-dialog'

const inviteUserMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    inviteUser: (...args: unknown[]) => inviteUserMock(...args),
  }
})

async function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient()
  const screen = await render(
    <QueryClientProvider client={client}>
      <UsersInviteDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return screen
}

describe('UsersInviteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog title and description', async () => {
    const { getByRole, getByText } = await renderDialog()

    const title = getByRole('heading', {
      level: 2,
      name: /邀请用户/,
    })
    const desc = getByText(/向新成员发送邮件邀请/)

    await expect.element(title).toBeInTheDocument()
    await expect.element(desc).toBeInTheDocument()
  })

  it('closes when the dialog close button is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await renderDialog(onOpenChange)

    await userEvent.click(getByRole('button', { name: '关闭' }))

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes when 取消 is clicked', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await renderDialog(onOpenChange)

    await userEvent.click(getByRole('button', { name: /^取消$/ }))

    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows validation messages when submitting empty form', async () => {
    const { getByRole, getByText } = await renderDialog()

    await userEvent.click(getByRole('button', { name: /发送邀请/ }))

    await expect.element(getByText('请输入受邀邮箱。')).toBeInTheDocument()
    await expect.element(getByText('请选择角色。')).toBeInTheDocument()
  })

  it('invites via the API and closes on success', async () => {
    inviteUserMock.mockResolvedValueOnce({})
    const onOpenChange = vi.fn()
    const { getByRole, getByLabelText } = await renderDialog(onOpenChange)

    await userEvent.fill(getByLabelText('邮箱'), 'new.member@example.com')
    await userEvent.click(getByRole('combobox'))
    await userEvent.click(getByRole('option', { name: '管理员', exact: true }))
    await userEvent.fill(getByLabelText('备注（可选）'), '欢迎加入团队')
    await userEvent.click(getByRole('button', { name: /发送邀请/ }))

    await vi.waitFor(() => expect(inviteUserMock).toHaveBeenCalledOnce())
    expect(inviteUserMock).toHaveBeenCalledWith({
      email: 'new.member@example.com',
      role: 'admin',
      desc: '欢迎加入团队',
    })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps the dialog open when the API rejects the invite', async () => {
    inviteUserMock.mockRejectedValueOnce(new Error('该邮箱已被邀请或注册。'))
    const onOpenChange = vi.fn()
    const { getByRole, getByLabelText } = await renderDialog(onOpenChange)

    await userEvent.fill(getByLabelText('邮箱'), 'taken@example.com')
    await userEvent.click(getByRole('combobox'))
    await userEvent.click(getByRole('option', { name: /经理/ }))
    await userEvent.click(getByRole('button', { name: /发送邀请/ }))

    await vi.waitFor(() => expect(inviteUserMock).toHaveBeenCalledOnce())
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
