import { type ContractClient, createContractClient } from './client.ts'

/**
 * Client for a same-origin API in a browser (e.g. the MSW mock in Vitest
 * browser mode). The browser owns the cookies, which outlive any one client,
 * so the harness passes `resetSession` to end the session between scenarios
 * (on the mock: clear the mock sessions and the cookie).
 *
 * `sessionCookies` is only for a harness that can read and write the session
 * cookie, i.e. the mock, whose cookie is not HttpOnly. A real back end keeps
 * its session cookie away from scripts, so a browser run against it leaves the
 * option out and the scenarios skip their cookie-replay steps.
 */
export function createBrowserClient({
  baseUrl = '',
  resetSession,
  sessionCookies,
}: {
  baseUrl?: string
  resetSession: () => void | Promise<void>
  sessionCookies?: ContractClient['sessionCookies']
}): ContractClient {
  const client = createContractClient(baseUrl, {
    send: (url, init) => fetch(url, { ...init, credentials: 'same-origin' }),
    forget: resetSession,
  })
  return sessionCookies ? Object.assign(client, { sessionCookies }) : client
}
