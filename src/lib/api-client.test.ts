import axios, { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { getApiErrorMessage, getErrorStatus } from './api-client'

describe('getErrorStatus', () => {
  it('reads the status from an Axios error response', () => {
    const error = new AxiosError('boom')
    error.response = { status: 403 } as AxiosError['response']

    expect(getErrorStatus(error)).toBe(403)
  })

  it('returns 0 for Axios errors without a response', () => {
    expect(getErrorStatus(new AxiosError('network'))).toBe(0)
  })

  it('reads the status from plain objects like TanStack Query errors', () => {
    expect(getErrorStatus({ status: 204 })).toBe(204)
    expect(getErrorStatus({ status: '404' })).toBe(404)
  })

  it('returns 0 for unknown error shapes', () => {
    expect(getErrorStatus(new Error('nope'))).toBe(0)
    expect(getErrorStatus(undefined)).toBe(0)
  })
})

describe('getApiErrorMessage', () => {
  it('prefers the problem-json title over message', () => {
    const error = new AxiosError('boom')
    error.response = {
      status: 422,
      data: { title: '校验失败', message: 'fallback' },
    } as AxiosError['response']

    expect(getApiErrorMessage(error)).toBe('校验失败')
  })

  it('falls back to the message field when title is absent', () => {
    const error = new AxiosError('boom')
    error.response = {
      status: 400,
      data: { message: '请求不合法' },
    } as AxiosError['response']

    expect(getApiErrorMessage(error)).toBe('请求不合法')
  })

  it('returns undefined when the response carries no readable field', () => {
    const error = new AxiosError('boom')
    error.response = { status: 500, data: {} } as AxiosError['response']

    expect(getApiErrorMessage(error)).toBeUndefined()
  })

  it('does not surface plain Error messages for non-Axios errors', () => {
    expect(getApiErrorMessage(new Error('plain failure'))).toBeUndefined()
    expect(getApiErrorMessage(undefined)).toBeUndefined()
  })

  it('recognises Axios errors via axios.isAxiosError', () => {
    expect(axios.isAxiosError(new AxiosError('x'))).toBe(true)
  })
})
