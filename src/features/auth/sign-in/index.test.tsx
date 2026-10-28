import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SignIn } from './index'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useSearch: () => ({ redirect: undefined }),
    useNavigate: () => vi.fn(),
  }
})

afterEach(() => vi.unstubAllEnvs())

describe('SignIn development credentials', () => {
  it('hides mock accounts when development mocks are disabled', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_ENABLE_MOCKS', 'false')
    const screen = await render(<SignIn />)
    await expect
      .element(screen.getByText(/演示密码/))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByText(/请输入账户信息，登录已接入的认证服务/))
      .toBeInTheDocument()
  })

  it('shows mock accounts when development mocks are enabled', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_ENABLE_MOCKS', 'true')
    const screen = await render(<SignIn />)
    await expect
      .element(screen.getByText(/演示密码：Demo1234!/))
      .toBeInTheDocument()
  })
})
