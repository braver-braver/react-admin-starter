import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { handleServerError } from './handle-server-error'

const toastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
  },
}))

beforeEach(() => {
  vi.mocked(toastError).mockClear()
})

describe('handleServerError', () => {
  it('shows a generic message when the error is not recognised', () => {
    handleServerError(new Error('network'))

    expect(toastError).toHaveBeenCalledWith('操作失败，请稍后重试。')
  })

  it('maps a plain object with status 204 to the no-content message', () => {
    handleServerError({ status: 204 })

    expect(toastError).toHaveBeenCalledWith('没有返回内容。')
  })

  it('shows only validated messages: an unvalidated response title is not displayed', () => {
    // Requests go through the contract client, which throws ApiError for
    // every error response; any other shape is treated as unknown.
    handleServerError({ response: { status: 422, data: { title: 'raw' } } })

    expect(toastError).toHaveBeenCalledWith('操作失败，请稍后重试。')
  })

  it('does not log raw error objects that can contain credentials', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = new Error('logged')

    handleServerError(err)

    expect(log).not.toHaveBeenCalled()

    log.mockRestore()
  })

  it('displays the validated API error message', () => {
    handleServerError(new ApiError(400, 'INVALID_REQUEST', '请求参数无效'))
    expect(toastError).toHaveBeenCalledWith('请求参数无效')
  })

  it('does not log the error to the console in production', () => {
    vi.stubEnv('DEV', false)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = new Error('not logged')

    handleServerError(err)

    expect(log).not.toHaveBeenCalled()

    log.mockRestore()
  })
})
