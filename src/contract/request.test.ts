import { describe, expect, it } from 'vitest'
import { operationBody, operationPath } from './request.ts'

describe('operationPath', () => {
  it('fills and encodes path parameters', () => {
    expect(
      operationPath({ path: '/users/{id}' }, { params: { id: 'a b/c' } })
    ).toBe('/users/a%20b%2Fc')
  })

  it('refuses a missing path parameter instead of sending a broken URL', () => {
    expect(() => operationPath({ path: '/users/{id}' })).toThrow(
      'Missing path parameter "id"'
    )
    expect(() =>
      operationPath({ path: '/users/{id}' }, { params: { id: '' } })
    ).toThrow()
  })

  it('sends arrays as repeated keys and leaves out empty values', () => {
    expect(
      operationPath(
        { path: '/users' },
        {
          query: {
            page: 2,
            pageSize: 10,
            username: '',
            status: ['active', 'invited'],
            role: [],
            sortBy: undefined,
            sortOrder: null,
          },
        }
      )
    ).toBe('/users?page=2&pageSize=10&status=active&status=invited')
  })

  it('returns the bare path when there is no query', () => {
    expect(operationPath({ path: '/auth/session' }, { query: {} })).toBe(
      '/auth/session'
    )
  })
})

describe('operationBody', () => {
  it('encodes JSON, passes FormData through for multipart, and omits no body', () => {
    expect(operationBody({}, { ids: ['1'] })).toBe('{"ids":["1"]}')
    expect(operationBody({}, undefined)).toBeUndefined()
    const form = new FormData()
    expect(operationBody({ multipart: true }, form)).toBe(form)
    expect(() => operationBody({ multipart: true }, { file: 'x' })).toThrow()
  })
})
