import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersDeleteDialog } from './users-delete-dialog'

const deleteUserMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    deleteUser: (...args: unknown[]) => deleteUserMock(...args),
  }
})

const currentUser: User = {
  id: 'usr-0001',
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

async function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient()
  const screen = await render(
    <QueryClientProvider client={client}>
      <UsersDeleteDialog
        open
        onOpenChange={onOpenChange}
        currentRow={currentUser}
      />
    </QueryClientProvider>
  )
  return screen
}

describe('UsersDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables the confirm button until the username matches', async () => {
    const { getByRole } = await renderDialog()

    const confirmButton = getByRole('button', { name: /^删除$/ })
    await expect.element(confirmButton).toBeDisabled()

    await userEvent.fill(
      page.getByPlaceholder('输入用户名以确认删除'),
      'wrong-name'
    )
    await expect.element(confirmButton).toBeDisabled()

    await userEvent.fill(
      page.getByPlaceholder('输入用户名以确认删除'),
      'zhang_wei'
    )
    await expect.element(confirmButton).toBeEnabled()
  })

  it('deletes via the API and closes on success', async () => {
    deleteUserMock.mockResolvedValueOnce(undefined)
    const onOpenChange = vi.fn()
    const { getByRole } = await renderDialog(onOpenChange)

    await userEvent.fill(
      page.getByPlaceholder('输入用户名以确认删除'),
      'zhang_wei'
    )
    await userEvent.click(getByRole('button', { name: /^删除$/ }))

    await vi.waitFor(() =>
      expect(deleteUserMock).toHaveBeenCalledWith('usr-0001')
    )
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps the dialog open when the API rejects', async () => {
    deleteUserMock.mockRejectedValueOnce(new Error('用户不存在。'))
    const onOpenChange = vi.fn()
    const { getByRole } = await renderDialog(onOpenChange)

    await userEvent.fill(
      page.getByPlaceholder('输入用户名以确认删除'),
      'zhang_wei'
    )
    await userEvent.click(getByRole('button', { name: /^删除$/ }))

    await vi.waitFor(() => expect(deleteUserMock).toHaveBeenCalledOnce())
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
