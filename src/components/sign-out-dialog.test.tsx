import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/features/auth/session', async (original) => ({
  ...(await original<typeof import('@/features/auth/session')>()),
  signOut: mocks.signOut,
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ href: '/users?username=alice' }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.signOut.mockResolvedValue(undefined)
})

describe('server logout dialog', () => {
  it('waits for server logout before navigating', async () => {
    const screen = await render(<SignOutDialog open onOpenChange={vi.fn()} />)
    await userEvent.click(
      screen.getByRole('button', { name: '退出登录', exact: true })
    )
    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/sign-in',
        search: { redirect: '/users?username=alice' },
        replace: true,
      })
    )
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
  it('keeps logout retryable after a network failure', async () => {
    mocks.signOut.mockRejectedValue(new Error('无法连接服务'))
    const screen = await render(<SignOutDialog open onOpenChange={vi.fn()} />)
    await userEvent.click(
      screen.getByRole('button', { name: '退出登录', exact: true })
    )
    await vi.waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('无法连接服务')
    )
    expect(mocks.navigate).not.toHaveBeenCalled()
    await expect
      .element(screen.getByRole('button', { name: '退出登录', exact: true }))
      .toBeEnabled()
  })
  it('does not call the API when cancelled', async () => {
    const screen = await render(<SignOutDialog open onOpenChange={vi.fn()} />)
    await userEvent.click(
      screen.getByRole('button', { name: '取消', exact: true })
    )
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
