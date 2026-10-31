import {
  assert,
  ContractAssertionError,
  expectError,
  expectSuccess,
} from './assert.ts'
import { type ContractClient } from './client.ts'
import type { Credentials, Scenario } from './scenarios.ts'

/**
 * Tier 1 business scenarios: what every back end must pass. Data they create
 * carries a random prefix and is deleted afterwards (and the deletion is
 * checked), so the suite can run repeatedly against a real back end.
 */

const unique = () =>
  `ct${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

const userBody = (prefix: string, suffix: string) => ({
  firstName: '一致',
  lastName: '测试',
  username: `${prefix}_${suffix}`,
  email: `${prefix}.${suffix}@example.test`,
  phoneNumber: '+8613800000000',
  role: 'cashier' as const,
})

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

async function signIn(client: ContractClient, account: Credentials) {
  return expectSuccess(await client.call('login', { body: account }), 'login')
}

async function createUser(
  client: ContractClient,
  prefix: string,
  suffix: string
) {
  return expectSuccess(
    await client.call('createUser', { body: userBody(prefix, suffix) }),
    'createUser'
  )
}

/**
 * Runs `body` with a list for the ids of the users it creates, then deletes
 * them and checks that the deletion worked. A failing cleanup is reported,
 * but never hides an earlier failure of the scenario itself.
 */
export async function withUsers(
  client: ContractClient,
  body: (ids: string[]) => Promise<void>
) {
  const ids: string[] = []
  let failure: unknown
  try {
    await body(ids)
  } catch (error) {
    failure = error
  }
  if (ids.length) {
    try {
      const removed = expectSuccess(
        await client.call('batchDeleteUsers', { body: { ids } }),
        'batchDeleteUsers'
      )
      assert(
        removed.deletedCount === ids.length,
        `cleanup: batchDeleteUsers deleted ${removed.deletedCount} of ${ids.length} users`
      )
    } catch (cleanup) {
      if (!failure) throw cleanup
      throw new ContractAssertionError(
        `${reason(failure)} (cleanup also failed: ${reason(cleanup)})`
      )
    }
  }
  if (failure) throw failure
}

/** A complete, decodable 1×1 PNG. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function pixelPng(): Uint8Array {
  return Uint8Array.from(atob(PIXEL_PNG), (char) => char.charCodeAt(0))
}

/**
 * The same valid PNG grown past `size` bytes by a tEXt chunk (correct length
 * and CRC) placed after IHDR, so only the size rule can reject it.
 */
export function pngLargerThan(size: number): Uint8Array {
  const base = pixelPng()
  const keyword = [...'Comment'].map((char) => char.charCodeAt(0))
  const data = new Uint8Array(keyword.length + 1 + size)
  data.set(keyword)
  data.fill(0x61, keyword.length + 1)
  const typeAndData = new Uint8Array(4 + data.length)
  typeAndData.set([0x74, 0x45, 0x58, 0x74]) // "tEXt"
  typeAndData.set(data, 4)
  const chunk = new Uint8Array(4 + typeAndData.length + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.length)
  chunk.set(typeAndData, 4)
  view.setUint32(4 + typeAndData.length, crc32(typeAndData))
  const afterIhdr = 8 + 25 // signature + IHDR (length, type, 13 bytes, CRC)
  const out = new Uint8Array(base.length + chunk.length)
  out.set(base.subarray(0, afterIhdr))
  out.set(chunk, afterIhdr)
  out.set(base.subarray(afterIhdr), afterIhdr + chunk.length)
  return out
}

export function tier1Scenarios(): Scenario[] {
  return [
    {
      name: 'login: valid credentials return a Session that getSession restores',
      tier: 1,
      async run(client, { admin }) {
        const login = await signIn(client, admin)
        assert(
          login.user.email.toLowerCase() === admin.email.toLowerCase(),
          'login: the Session belongs to the signed-in account'
        )
        assert(login.csrfToken, 'login: the Session carries a csrfToken')
        const session = expectSuccess(
          await client.call('getSession'),
          'getSession'
        )
        assert(
          session.user.id === login.user.id,
          'getSession: the cookie restores the same account'
        )
      },
    },
    {
      name: 'getSession: without a session cookie returns 401 UNAUTHENTICATED',
      tier: 1,
      async run(client) {
        expectError(await client.call('getSession'), 401, 'UNAUTHENTICATED')
      },
    },
    {
      name: 'login: a wrong password returns 401 INVALID_CREDENTIALS and starts no session',
      tier: 1,
      async run(client, { admin }) {
        const response = await client.call('login', {
          body: { email: admin.email, password: `${admin.password}-wrong` },
        })
        expectError(response, 401, 'INVALID_CREDENTIALS')
        if (client.sessionCookies) {
          assert(
            client.sessionCookies.save() === undefined,
            'login: a failed login must not set a session cookie'
          )
        }
        expectError(await client.call('getSession'), 401, 'UNAUTHENTICATED')
      },
    },
    {
      name: 'logout: revokes the session on the server; the old cookie then gets 401 from getSession',
      tier: 1,
      async run(client, { admin }) {
        await signIn(client, admin)
        const saved = client.sessionCookies?.save()
        expectSuccess(await client.call('logout'), 'logout')
        expectError(await client.call('getSession'), 401, 'UNAUTHENTICATED')
        if (client.sessionCookies) {
          client.sessionCookies.restore(saved)
          expectError(await client.call('getSession'), 401, 'UNAUTHENTICATED')
        }
      },
    },
    {
      name: 'listUsers: page, pageSize and meta.total agree; filtering and sorting happen on the server',
      tier: 1,
      async run(client, { admin }) {
        await signIn(client, admin)
        const prefix = unique()
        await withUsers(client, async (ids) => {
          for (const suffix of ['a', 'b', 'c'])
            ids.push((await createUser(client, prefix, suffix)).id)
          const page = async (n: number, sortOrder: 'asc' | 'desc') =>
            expectSuccess(
              await client.call('listUsers', {
                query: {
                  page: n,
                  pageSize: 2,
                  username: prefix,
                  sortBy: 'username',
                  sortOrder,
                },
              }),
              'listUsers'
            )
          const first = await page(1, 'asc')
          const second = await page(2, 'asc')
          assert(
            first.meta.total === 3,
            `listUsers: meta.total is ${first.meta.total}, expected 3`
          )
          assert(
            first.meta.page === 1 &&
              first.meta.pageSize === 2 &&
              first.meta.totalPageCount === 2,
            'listUsers: meta must echo page 1, pageSize 2 and report 2 pages'
          )
          const ascending = [...first.items, ...second.items].map(
            (user) => user.username
          )
          assert(
            ascending.join() ===
              [`${prefix}_a`, `${prefix}_b`, `${prefix}_c`].join(),
            `listUsers: pages must cover the 3 users once, sorted by username (got ${ascending.join()})`
          )
          const descending = (await page(1, 'desc')).items.map(
            (user) => user.username
          )
          assert(
            descending.join() === [`${prefix}_c`, `${prefix}_b`].join(),
            `listUsers: sortOrder=desc must reverse the order (got ${descending.join()})`
          )
          expectSuccess(
            await client.call('updateUsersStatus', {
              body: { ids: [ids[1]], status: 'inactive' },
            }),
            'updateUsersStatus'
          )
          const inactive = expectSuccess(
            await client.call('listUsers', {
              query: {
                page: 1,
                pageSize: 10,
                username: prefix,
                status: ['inactive'],
              },
            }),
            'listUsers'
          )
          assert(
            inactive.meta.total === 1 && inactive.items[0]?.id === ids[1],
            'listUsers: status=inactive must return only the deactivated user'
          )
        })
      },
    },
    {
      name: 'createUser/updateUser/deleteUser: CRUD works; duplicates get 422 DUPLICATE_USER; unknown ids get 404 USER_NOT_FOUND',
      tier: 1,
      async run(client, { admin }) {
        await signIn(client, admin)
        const prefix = unique()
        await withUsers(client, async (ids) => {
          const created = await createUser(client, prefix, 'crud')
          ids.push(created.id)
          assert(
            created.username === `${prefix}_crud`,
            'createUser: returns the created user'
          )
          expectError(
            await client.call('createUser', { body: userBody(prefix, 'crud') }),
            422,
            'DUPLICATE_USER'
          )
          const updated = expectSuccess(
            await client.call('updateUser', {
              params: { id: created.id },
              body: { ...userBody(prefix, 'crud'), firstName: '已更新' },
            }),
            'updateUser'
          )
          assert(
            updated.firstName === '已更新',
            'updateUser: the change is returned'
          )
          expectError(
            await client.call('updateUser', {
              params: { id: `${prefix}-missing` },
              body: userBody(prefix, 'other'),
            }),
            404,
            'USER_NOT_FOUND'
          )
          expectSuccess(
            await client.call('deleteUser', { params: { id: created.id } }),
            'deleteUser'
          )
          ids.pop()
          expectError(
            await client.call('deleteUser', { params: { id: created.id } }),
            404,
            'USER_NOT_FOUND'
          )
        })
      },
    },
    {
      name: 'uploadFile: accepts a small image; rejects a non-image (422 UNSUPPORTED_FILE_TYPE) and a file over 2 MB (422 FILE_TOO_LARGE)',
      tier: 1,
      async run(client, { admin }) {
        await signIn(client, admin)
        const upload = (bytes: BlobPart, type: string, name: string) => {
          const form = new FormData()
          form.append('file', new Blob([bytes], { type }), name)
          return client.call('uploadFile', { body: form })
        }
        const ok = expectSuccess(
          await upload(pixelPng() as BlobPart, 'image/png', 'pixel.png'),
          'uploadFile'
        )
        assert(ok.url, 'uploadFile: the result has a url')
        expectError(
          await upload('hello', 'text/plain', 'note.txt'),
          422,
          'UNSUPPORTED_FILE_TYPE'
        )
        expectError(
          await upload(
            pngLargerThan(2 * 1024 * 1024) as BlobPart,
            'image/png',
            'large.png'
          ),
          422,
          'FILE_TOO_LARGE'
        )
      },
    },
    {
      name: 'listAuditLogs: needs audit:read (viewer gets 403 FORBIDDEN); entries are newest first',
      tier: 1,
      async run(client, { admin, viewer }) {
        await signIn(client, viewer)
        expectError(
          await client.call('listAuditLogs', {
            query: { page: 1, pageSize: 10 },
          }),
          403,
          'FORBIDDEN'
        )
        await client.forget()
        await signIn(client, admin)
        const logs = expectSuccess(
          await client.call('listAuditLogs', {
            query: { page: 1, pageSize: 20 },
          }),
          'listAuditLogs'
        )
        const times = logs.items.map((log) => log.createdAt.getTime())
        assert(
          times.every((time, i) => i === 0 || times[i - 1] >= time),
          'listAuditLogs: entries must be ordered by createdAt, newest first'
        )
      },
    },
    {
      name: 'audit: createUser leaves a user.created entry naming the actor and the user (listAuditLogs)',
      tier: 1,
      async run(client, { admin }) {
        await signIn(client, admin)
        const prefix = unique()
        await withUsers(client, async (ids) => {
          const user = await createUser(client, prefix, 'audit')
          ids.push(user.id)
          const logs = expectSuccess(
            await client.call('listAuditLogs', {
              query: { page: 1, pageSize: 50, action: ['user.created'] },
            }),
            'listAuditLogs'
          )
          const entry = logs.items.find(
            (log) =>
              log.target.includes(user.username) ||
              log.target.includes(user.email)
          )
          assert(
            entry,
            'audit: no user.created entry mentions the created user'
          )
          assert(
            entry.actorEmail.toLowerCase() === admin.email.toLowerCase(),
            'audit: the entry names the signed-in actor'
          )
        })
      },
    },
  ]
}
