import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const navigate = vi.fn()
const reset = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: { reset },
  }),
}))

vi.mock('@/features/auth/api', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

async function renderDialog() {
  const queryClient = new QueryClient()
  const clearSpy = vi.spyOn(queryClient, 'clear')
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <SignOutDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
  return { screen, clearSpy }
}

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs out, clears session caches and navigates to sign-in', async () => {
    const { screen, clearSpy } = await renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /^退出登录$/ }))

    expect(signOutMock).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledOnce()
    expect(clearSpy).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      replace: true,
    })
  })

  it('does not sign out when Cancel is clicked', async () => {
    const { screen, clearSpy } = await renderDialog()

    await userEvent.click(screen.getByRole('button', { name: /^取消$/ }))

    expect(signOutMock).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect(clearSpy).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
