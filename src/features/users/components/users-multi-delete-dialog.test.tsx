import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTableMock } from '@/test-utils/tanstack-table'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

const batchDeleteUsersMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    batchDeleteUsers: (...args: unknown[]) => batchDeleteUsersMock(...args),
  }
})

async function renderDialog(
  table: ReturnType<typeof createTableMock>['table'],
  onOpenChange = vi.fn()
) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <UsersMultiDeleteDialog open onOpenChange={onOpenChange} table={table} />
    </QueryClientProvider>
  )
}

describe('UsersMultiDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables confirm until the confirm word matches', async () => {
    const { table } = createTableMock(2, [
      { id: 'usr-0001' },
      { id: 'usr-0002' },
    ])
    const { getByRole } = await renderDialog(table)

    const confirmButton = getByRole('button', { name: /^删除$/ })
    await expect.element(confirmButton).toBeDisabled()

    await userEvent.fill(page.getByPlaceholder(/确认/), '删')
    await expect.element(confirmButton).toBeDisabled()

    await userEvent.fill(page.getByPlaceholder(/确认/), '删除')
    await expect.element(confirmButton).toBeEnabled()
  })

  it('batch-deletes selected rows via the API', async () => {
    batchDeleteUsersMock.mockResolvedValueOnce(2)
    const { table, resetRowSelection } = createTableMock(2, [
      { id: 'usr-0001' },
      { id: 'usr-0002' },
    ])
    const onOpenChange = vi.fn()
    const { getByRole } = await renderDialog(table, onOpenChange)

    await userEvent.fill(page.getByPlaceholder(/确认/), '删除')
    const confirm = getByRole('button', { name: /^删除$/ })
    await expect.element(confirm).toBeEnabled()
    await userEvent.click(confirm)

    await vi.waitFor(() =>
      expect(batchDeleteUsersMock).toHaveBeenCalledWith([
        'usr-0001',
        'usr-0002',
      ])
    )
    await vi.waitFor(() => expect(resetRowSelection).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
