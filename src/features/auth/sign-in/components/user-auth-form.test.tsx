import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), signIn: vi.fn() }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
}))
vi.mock('@/features/auth/session', async (original) => ({
  ...(await original<typeof import('@/features/auth/session')>()),
  signIn: mocks.signIn,
}))

async function submit(redirectTo?: string) {
  const screen = await render(<UserAuthForm redirectTo={redirectTo} />)
  await userEvent.fill(
    screen.getByRole('textbox', { name: '邮箱' }),
    'admin@example.com'
  )
  await userEvent.fill(
    screen.getByLabelText('密码', { exact: true }),
    'Demo1234!'
  )
  await userEvent.click(
    screen.getByRole('button', { name: '登录', exact: true })
  )
  return screen
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signIn.mockResolvedValue({})
})

describe('API login form', () => {
  it('validates required fields before calling the API', async () => {
    const screen = await render(<UserAuthForm />)
    await userEvent.click(
      screen.getByRole('button', { name: '登录', exact: true })
    )
    await expect.element(screen.getByText('请输入邮箱。')).toBeInTheDocument()
    await expect.element(screen.getByText('请输入密码。')).toBeInTheDocument()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
  it('calls authentication and preserves a safe return path', async () => {
    await submit('/users?username=alice')
    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/users?username=alice',
        replace: true,
      })
    )
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'Demo1234!',
    })
  })
  it('rejects an external return path', async () => {
    await submit('https://evil.example/')
    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
    )
  })
  it('shows API rejection and never navigates', async () => {
    mocks.signIn.mockRejectedValue(new Error('邮箱或密码错误。'))
    const screen = await submit()
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('邮箱或密码错误。')
    expect(mocks.navigate).not.toHaveBeenCalled()
    await expect
      .element(screen.getByRole('button', { name: '登录', exact: true }))
      .toBeEnabled()
  })
  it('allows a configured real API to authenticate in production', async () => {
    vi.stubEnv('PROD', true)
    try {
      await submit()
      await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce())
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
