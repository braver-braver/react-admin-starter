import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useAuthStore } from '@/stores/auth-store'
import { SidebarProvider } from '@/components/ui/sidebar'
import { NavUser } from './nav-user'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ href: '/' }),
}))
afterEach(() => useAuthStore.getState().auth.reset())

describe('account menu permissions', () => {
  it.each([
    ['guest', []],
    ['admin', ['users:read']],
  ] as const)('filters footer navigation for %s', async (role, permissions) => {
    useAuthStore.getState().auth.setSession({
      user: {
        id: role,
        name: role,
        email: `${role}@example.com`,
        roles: [role],
        permissions: [...permissions],
      },
      csrfToken: 'csrf',
    })
    const screen = await render(
      <SidebarProvider>
        <NavUser
          user={{ name: role, email: `${role}@example.com`, avatar: '' }}
        />
      </SidebarProvider>
    )
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`${role}@example.com`) })
    )
    if (role === 'admin')
      await expect
        .element(screen.getByRole('menuitem', { name: '用户管理示例' }))
        .toBeInTheDocument()
    else
      await expect
        .element(screen.getByRole('menuitem', { name: '用户管理示例' }))
        .not.toBeInTheDocument()
    await expect
      .element(screen.getByRole('menuitem', { name: '退出登录' }))
      .toBeInTheDocument()
  })
})
