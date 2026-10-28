import { delay, http, HttpResponse } from 'msw'
import {
  findDemoAccount,
  issueMockToken,
  resolveMockToken,
  toSessionUser,
} from '../data/accounts'

/**
 * 认证相关 mock handlers。
 *
 * 错误响应统一使用 problem json 风格（{ title, detail }），
 * 与 src/lib/api-client.ts 的错误契约保持一致。
 */

const MOCK_LATENCY_MS = 300
const SESSION_EXPIRED_BODY = { title: '登录状态已过期，请重新登录。' }

function unauthorized(body: Record<string, string>) {
  return HttpResponse.json(body, { status: 401 })
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

export const authHandlers = [
  http.post('/api/auth/sign-in', async ({ request }) => {
    await delay(MOCK_LATENCY_MS)

    const body = (await request.json().catch(() => null)) as {
      email?: unknown
      password?: unknown
    } | null
    const email = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    const account = findDemoAccount(email, password)
    if (!account) {
      return unauthorized({ title: '邮箱或密码错误，请重试。' })
    }

    return HttpResponse.json({
      accessToken: issueMockToken(account),
      user: toSessionUser(account),
    })
  }),

  http.get('/api/auth/session', async ({ request }) => {
    await delay(MOCK_LATENCY_MS)

    const account = resolveMockToken(bearerToken(request))
    if (!account) {
      return unauthorized(SESSION_EXPIRED_BODY)
    }

    return HttpResponse.json(toSessionUser(account))
  }),

  http.post('/api/auth/sign-out', async () => {
    await delay(MOCK_LATENCY_MS)
    return new HttpResponse(null, { status: 204 })
  }),
]
