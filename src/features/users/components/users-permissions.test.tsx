import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useAuthStore } from '@/stores/auth-store'
import { UsersPrimaryButtons } from './users-primary-buttons'
import { UsersProvider, useUsers } from './users-provider'

function Harness() {
  const { open } = useUsers()
  return (
    <>
      <UsersPrimaryButtons />
      <output aria-label='当前操作'>{open ?? '无'}</output>
    </>
  )
}
afterEach(() => useAuthStore.getState().auth.reset())

describe('user write permissions', () => {
  it('allows an administrator to open the create interaction', async () => {
    useAuthStore.getState().auth.setSession({
      user: {
        id: 'admin',
        name: '管理员',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: ['users:read', 'users:write'],
      },
      csrfToken: 'csrf',
    })
    const screen = await render(
      <UsersProvider>
        <Harness />
      </UsersProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: '添加用户' }))
    await expect
      .element(screen.getByLabelText('当前操作'))
      .toHaveTextContent('add')
  })
  it('hides create and invite operations from a read-only user', async () => {
    useAuthStore.getState().auth.setSession({
      user: {
        id: 'viewer',
        name: '只读用户',
        email: 'viewer@example.com',
        roles: ['viewer'],
        permissions: ['users:read'],
      },
      csrfToken: 'csrf',
    })
    const screen = await render(
      <UsersProvider>
        <Harness />
      </UsersProvider>
    )
    await expect
      .element(screen.getByRole('button', { name: '添加用户' }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: '邀请用户' }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByLabelText('当前操作'))
      .toHaveTextContent('无')
  })
})
