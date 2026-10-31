import type { Operation } from './operations.ts'

/**
 * Builds the HTTP request of a registry operation. Pure and free of browser
 * APIs, so the app client (`lib/api.ts`) and a Node test runner share it.
 */

export type RequestParts = {
  /** Path parameters, e.g. `{ id }` for `/users/{id}`. */
  params?: Readonly<Record<string, string>>
  /** Query values; arrays become repeated keys (`status=a&status=b`). */
  query?: Readonly<Record<string, unknown>>
}

/**
 * Path relative to `API_PREFIX`, with path parameters filled in and the query
 * string appended. `undefined`, `null` and empty strings are left out.
 */
export function operationPath(
  op: Pick<Operation, 'path'>,
  { params = {}, query }: RequestParts = {}
): `/${string}` {
  const path = op.path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name]
    if (value === undefined || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${op.path}`)
    }
    return encodeURIComponent(value)
  })
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue
      search.append(key, String(item))
    }
  }
  const queryString = search.toString()
  return (queryString ? `${path}?${queryString}` : path) as `/${string}`
}

/** Request body: JSON text, or the `FormData` of a multipart operation. */
export function operationBody(
  op: Pick<Operation, 'multipart'>,
  body: unknown
): string | FormData | undefined {
  if (body === undefined) return undefined
  if (op.multipart) {
    if (!(body instanceof FormData)) {
      throw new Error('A multipart operation needs a FormData body')
    }
    return body
  }
  return JSON.stringify(body)
}
