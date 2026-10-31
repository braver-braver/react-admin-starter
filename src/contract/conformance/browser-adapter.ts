import { type ContractClient, createContractClient } from './client.ts'

/**
 * Client for a same-origin API in a browser (e.g. the MSW mock in Vitest
 * browser mode). The browser owns the cookies, which outlive any one client,
 * so the harness passes `resetSession` to end the session between scenarios
 * (on the mock: clear the mock sessions and the cookie).
 */
export function createBrowserClient({
  baseUrl = '',
  resetSession,
}: {
  baseUrl?: string
  resetSession: () => void | Promise<void>
}): ContractClient {
  return createContractClient(baseUrl, {
    send: (url, init) => fetch(url, { ...init, credentials: 'same-origin' }),
    forget: resetSession,
  })
}
