import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiRequest,
  invalidateApiRequests,
  setAuthErrorHandler,
} from './api'

const resultSchema = z.object({ value: z.string() })
const success = (value = 'ok') =>
  new Response(JSON.stringify({ data: { value } }), { status: 200 })
const failure = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

describe('apiRequest', () => {
  beforeEach(() => {
    invalidateApiRequests()
    setAuthErrorHandler(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('sends same-origin credentials and CSRF headers for a JSON mutation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(success())
    await expect(
      apiRequest('/items', resultSchema, {
        method: 'POST',
        body: JSON.stringify({ name: 'sample' }),
        csrfToken: 'csrf-value',
        credentials: 'include',
        headers: { 'X-Trace': 'trace-value' },
      })
    ).resolves.toEqual({ value: 'ok' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [path, init] = fetchMock.mock.calls[0]
    // Callers pass paths relative to API_PREFIX; the client adds it.
    expect(path).toBe('/api/v1/items')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    })
    const headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Requested-With')).toBe('ReactAdminStarter')
    expect(headers.get('X-CSRF-Token')).toBe('csrf-value')
    expect(headers.get('X-Trace')).toBe('trace-value')
  })

  it.each([
    { body: { data: { value: 3 } }, label: 'wrong data shape' },
    { body: { value: 'ok' }, label: 'missing data envelope' },
  ])('rejects a successful response with $label as 502', async ({ body }) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 })
    )
    await expect(apiRequest('/items', resultSchema)).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  })

  it('preserves the server error status, code and message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      failure(422, { error: { code: 'INVALID_ITEM', message: 'Bad item' } })
    )
    await expect(apiRequest('/items', resultSchema)).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_ITEM',
      message: 'Bad item',
    })
  })

  it('keeps the HTTP status when the error body is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      failure(503, { unexpected: true })
    )
    await expect(apiRequest('/items', resultSchema)).rejects.toMatchObject({
      status: 503,
      code: 'HTTP_ERROR',
    })
  })

  it.each([401, 403])(
    'calls the centralized auth handler on %i',
    async (status) => {
      const handler = vi.fn()
      setAuthErrorHandler(handler)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        failure(status, { error: { code: 'DENIED', message: 'Denied' } })
      )
      await expect(apiRequest('/items', resultSchema)).rejects.toMatchObject({
        status,
      })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler.mock.calls[0][0]).toBeInstanceOf(ApiError)
    }
  )

  it('allows auth endpoints to handle 401 themselves', async () => {
    const handler = vi.fn()
    setAuthErrorHandler(handler)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failure(401, null))
    await expect(
      apiRequest('/auth/session', resultSchema, { handleAuthError: false })
    ).rejects.toMatchObject({ status: 401 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('preserves an aborted request and normalizes a network failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const abort = new DOMException('stopped', 'AbortError')
    fetchMock.mockRejectedValueOnce(abort)
    await expect(apiRequest('/items', resultSchema)).rejects.toBe(abort)

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiRequest('/items', resultSchema)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('discards a response from the old identity without invoking auth handling', async () => {
    const handler = vi.fn()
    setAuthErrorHandler(handler)
    let resolveFetch!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve))
    )
    const request = apiRequest('/items', resultSchema)
    invalidateApiRequests()
    resolveFetch(success('old'))
    await expect(request).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_CHANGED',
    })
    expect(handler).not.toHaveBeenCalled()
  })
})
