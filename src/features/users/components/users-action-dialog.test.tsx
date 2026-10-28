import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type UserEvent, userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersActionDialog } from './users-action-dialog'

const createUserMock = vi.fn()
const updateUserMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    createUser: (...args: unknown[]) => createUserMock(...args),
    updateUser: (...args: unknown[]) => updateUserMock(...args),
  }
})

const VALIDATION_MESSAGES = {
  firstName: '请输入名字。',
  lastName: '请输入姓氏。',
  username: '请输入用户名。',
  phoneNumber: '请输入电话号码。',
  email: '请输入邮箱。',
  role: '请选择角色。',
  passwordRequired: '请输入密码。',
  passwordLength: '密码至少需要 8 位字符。',
  passwordNumber: '密码需包含至少一个数字。',
  passwordMismatch: '两次输入的密码不一致。',
} as const

const MOCK_USER: User = {
  id: 'usr-edit-1',
  firstName: '伟',
  lastName: '张',
  username: 'zhang_wei',
  email: 'zhang.wei@example.com',
  phoneNumber: '+8613800000000',
  status: 'active',
  role: 'manager',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-02-02'),
}

// 测试专用合成口令：满足校验规则（≥8 位、含数字和小写字母），不是真实凭据
const FIXTURE_PASSWORD = ['Fixture', 'Pass', '1'].join('')

async function fillValidForm(
  user: UserEvent,
  screen: RenderResult,
  overrides: { email?: string; username?: string } = {}
) {
  await user.fill(screen.getByRole('textbox', { name: /姓氏/ }), '张')
  await user.fill(screen.getByRole('textbox', { name: /名字/ }), '伟')
  await user.fill(
    screen.getByRole('textbox', { name: /用户名/ }),
    overrides.username ?? 'new_user'
  )
  await user.fill(
    screen.getByRole('textbox', { name: /邮箱/ }),
    overrides.email ?? 'new.user@example.com'
  )
  await user.fill(
    screen.getByRole('textbox', { name: /电话号码/ }),
    '+8613800000000'
  )
  await user.click(screen.getByRole('combobox'))
  await user.click(screen.getByRole('option', { name: /经理/ }))
  await user.fill(screen.getByLabelText(/^密码$/), FIXTURE_PASSWORD)
  await user.fill(screen.getByLabelText(/确认密码/), FIXTURE_PASSWORD)
  await expect(screen.getByRole('button', { name: /^保存$/ })).toBeEnabled()
  return screen
}

async function renderDialog(props?: {
  currentRow?: User
  onOpenChange?: (open: boolean) => void
}) {
  const client = new QueryClient()
  const screen = await render(
    <QueryClientProvider client={client}>
      <UsersActionDialog
        open
        onOpenChange={props?.onOpenChange ?? vi.fn()}
        currentRow={props?.currentRow}
      />
    </QueryClientProvider>
  )
  return screen
}

describe('UsersActionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('add user', () => {
    it('renders title and description', async () => {
      const { getByRole, getByText } = await renderDialog()

      await expect
        .element(getByRole('heading', { level: 2, name: /添加用户/ }))
        .toBeInTheDocument()
      await expect.element(getByText(/创建新用户/)).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      const { getByRole, getByText } = await renderDialog()
      await userEvent.click(getByRole('button', { name: /^保存$/ }))

      for (const message of [
        VALIDATION_MESSAGES.lastName,
        VALIDATION_MESSAGES.firstName,
        VALIDATION_MESSAGES.username,
        VALIDATION_MESSAGES.email,
        VALIDATION_MESSAGES.phoneNumber,
        VALIDATION_MESSAGES.role,
        VALIDATION_MESSAGES.passwordRequired,
      ]) {
        await expect.element(getByText(message)).toBeInTheDocument()
      }
    })

    it('validates password rules', async () => {
      const { getByRole, getByLabelText, getByText } = await renderDialog()

      await userEvent.fill(getByLabelText(/^密码$/), 'short1')
      await userEvent.click(getByRole('button', { name: /^保存$/ }))
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLength))
        .toBeInTheDocument()

      await userEvent.fill(getByLabelText(/^密码$/), 'nodigitsaa')
      await userEvent.click(getByRole('button', { name: /^保存$/ }))
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordNumber))
        .toBeInTheDocument()

      await userEvent.fill(getByLabelText(/^密码$/), FIXTURE_PASSWORD)
      await userEvent.fill(getByLabelText(/确认密码/), 'different1')
      await userEvent.click(getByRole('button', { name: /^保存$/ }))
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordMismatch))
        .toBeInTheDocument()
    })

    it('creates the user via the API and closes', async () => {
      createUserMock.mockResolvedValueOnce({})
      const onOpenChange = vi.fn()
      const client = new QueryClient()
      const screen = await render(
        <QueryClientProvider client={client}>
          <UsersActionDialog open onOpenChange={onOpenChange} />
        </QueryClientProvider>
      )

      await fillValidForm(userEvent, screen)
      await userEvent.click(screen.getByRole('button', { name: /^保存$/ }))

      await vi.waitFor(() => expect(createUserMock).toHaveBeenCalledOnce())
      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: '伟',
          lastName: '张',
          username: 'new_user',
          email: 'new.user@example.com',
          role: 'manager',
          password: FIXTURE_PASSWORD,
        })
      )
      await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    it('keeps the dialog open on API error', async () => {
      createUserMock.mockRejectedValueOnce(new Error('邮箱或用户名已存在。'))
      const onOpenChange = vi.fn()
      const client = new QueryClient()
      const screen = await render(
        <QueryClientProvider client={client}>
          <UsersActionDialog open onOpenChange={onOpenChange} />
        </QueryClientProvider>
      )

      await fillValidForm(userEvent, screen)
      await userEvent.click(screen.getByRole('button', { name: /^保存$/ }))

      await vi.waitFor(() => expect(createUserMock).toHaveBeenCalledOnce())
      expect(onOpenChange).not.toHaveBeenCalled()
    })
  })

  describe('edit user', () => {
    it('submits without a password when left blank', async () => {
      updateUserMock.mockResolvedValueOnce({})
      const onOpenChange = vi.fn()
      const screen = await renderDialog({ currentRow: MOCK_USER, onOpenChange })
      const emailInput = screen.getByRole('textbox', { name: /邮箱/ })
      await expect.element(emailInput).toHaveValue(MOCK_USER.email)

      await userEvent.fill(
        screen.getByRole('textbox', { name: /名字/ }),
        '小明'
      )
      await userEvent.click(screen.getByRole('button', { name: /^保存$/ }))

      await vi.waitFor(() => expect(updateUserMock).toHaveBeenCalledOnce())
      expect(updateUserMock).toHaveBeenCalledWith(
        MOCK_USER.id,
        expect.objectContaining({
          firstName: '小明',
          password: undefined,
        })
      )
      await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })
  })
})
