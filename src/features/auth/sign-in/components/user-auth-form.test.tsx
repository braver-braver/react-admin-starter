import { deriveDemoPassword } from '@/mocks/data/accounts'
import { clearCookies } from '@/test-utils/cookies'
import { resetMockApi, startMockApi, stopMockApi } from '@/test-utils/msw'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { useAuthStore } from '@/stores/auth-store'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: '请输入邮箱。',
  passwordEmpty: '请输入密码。',
  passwordShort: '密码至少需要 7 位。',
} as const

const navigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

describe('UserAuthForm (MSW)', () => {
  beforeAll(startMockApi)
  afterAll(stopMockApi)

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().auth.reset()
    clearCookies()
  })

  afterEach(() => {
    resetMockApi()
  })

  describe('rendering and validation', () => {
    let screen: RenderResult
    let emailInput: Locator
    let passwordInput: Locator
    let signInButton: Locator

    beforeEach(async () => {
      screen = await render(<UserAuthForm />)
      emailInput = screen.getByRole('textbox', { name: /^邮箱$/ })
      passwordInput = screen.getByLabelText(/^密码$/)
      signInButton = screen.getByRole('button', { name: /^登录$/ })
    })

    it('renders fields and submit button', async () => {
      await expect.element(emailInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
    })

    it('shows the demo accounts hint in development', async () => {
      await expect
        .element(screen.getByText('演示账号（点击自动填充）'))
        .toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.emailEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })
  })

  it('fills the form from the demo hint button', async () => {
    const { getByRole, getByLabelText } = await render(<UserAuthForm />)

    await userEvent.click(getByRole('button', { name: '管理员' }))

    await expect
      .element(getByRole('textbox', { name: /^邮箱$/ }))
      .toHaveValue('admin@example.com')
    await expect
      .element(getByLabelText(/^密码$/))
      .toHaveValue(deriveDemoPassword('admin'))
  })

  it('signs in via the mock API and navigates to home', async () => {
    const { getByRole, getByLabelText } = await render(<UserAuthForm />)

    await userEvent.fill(
      getByRole('textbox', { name: /^邮箱$/ }),
      'admin@example.com'
    )
    await userEvent.fill(getByLabelText(/^密码$/), deriveDemoPassword('admin'))
    await userEvent.click(getByRole('button', { name: /^登录$/ }))

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce())
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })

    const { auth } = useAuthStore.getState()
    expect(auth.accessToken).toBeTruthy()
    expect(auth.user?.email).toBe('admin@example.com')
    expect(auth.user?.roles).toEqual(['admin'])
  })

  it('keeps the user on the page when credentials are rejected', async () => {
    const { getByRole, getByLabelText } = await render(<UserAuthForm />)

    await userEvent.fill(
      getByRole('textbox', { name: /^邮箱$/ }),
      'admin@example.com'
    )
    await userEvent.fill(getByLabelText(/^密码$/), 'wrong-password')
    await userEvent.click(getByRole('button', { name: /^登录$/ }))

    await vi.waitFor(() =>
      expect(useAuthStore.getState().auth.accessToken).toBe('')
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
