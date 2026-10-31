import { type ContractClient, createContractClient } from './client.ts'

/**
 * Client for a same-origin API in a browser (e.g. the MSW mock in Vitest
 * browser mode). The browser keeps the cookies, so `forget()` drops only the
 * CSRF token; sign out through the API to end the server session.
 */
export function createBrowserClient(baseUrl = ''): ContractClient {
  return createContractClient(baseUrl, {
    send: (url, init) => fetch(url, { ...init, credentials: 'same-origin' }),
    forget() {},
  })
}
