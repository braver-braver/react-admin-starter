import { type ContractClient, createContractClient } from './client.ts'

/**
 * Minimal cookie jar for a single API origin: stores `name=value` from
 * `Set-Cookie`, drops cookies set with `Max-Age<=0` or an expiry in the past,
 * and sends the rest back as one `Cookie` header. Paths and domains are not
 * tracked, because every request goes to the same API prefix.
 */
export class CookieJar {
  readonly #cookies = new Map<string, string>()

  store(response: Response) {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(';')
      const separator = pair.indexOf('=')
      if (separator <= 0) continue
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      // Max-Age wins over Expires when both are present and valid (RFC 6265).
      const options = new Map(
        attributes.map((attribute) => {
          const [key, ...rest] = attribute.split('=')
          return [key.trim().toLowerCase(), rest.join('=').trim()] as const
        })
      )
      const maxAge = Number(options.get('max-age'))
      const expires = Date.parse(options.get('expires') ?? '')
      const expired =
        options.has('max-age') && Number.isFinite(maxAge)
          ? maxAge <= 0
          : Number.isFinite(expires) && expires <= Date.now()
      if (expired || value === '') this.#cookies.delete(name)
      else this.#cookies.set(name, value)
    }
  }

  header(): string | undefined {
    if (this.#cookies.size === 0) return undefined
    return [...this.#cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  has(name: string) {
    return this.#cookies.has(name)
  }

  /** The jar's cookies as `name=value; …`, to put back later with `load`. */
  save(): string | undefined {
    return this.header()
  }

  load(saved: string | undefined) {
    this.#cookies.clear()
    for (const pair of saved?.split('; ') ?? []) {
      const separator = pair.indexOf('=')
      if (separator > 0)
        this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
  }

  clear() {
    this.#cookies.clear()
  }
}

/**
 * Client for a real back end over HTTP (Node 22 `fetch`), with its own jar.
 * Once `signal` aborts (the runner aborts a scenario that timed out), every
 * request in flight is cancelled and every later call rejects.
 */
export function createNodeClient(
  baseUrl: string,
  jar = new CookieJar(),
  { signal }: { signal?: AbortSignal } = {}
): ContractClient & { jar: CookieJar } {
  const client = createContractClient(baseUrl, {
    async send(url, init) {
      signal?.throwIfAborted()
      const headers = new Headers(init.headers)
      const cookie = jar.header()
      if (cookie) headers.set('Cookie', cookie)
      const response = await fetch(url, { ...init, headers, signal })
      jar.store(response)
      return response
    },
    forget: () => jar.clear(),
  })
  return Object.assign(client, {
    jar,
    sessionCookies: {
      save: () => jar.save(),
      restore: (saved: string | undefined) => jar.load(saved),
    },
  })
}
