import { describe, expect, it } from 'vitest'
import { type Operation, operations } from '../operations.ts'
import { type ContractClient, type ContractResponse } from './client.ts'
import { pixelPng, pngLargerThan, withUsers } from './tier1.ts'

describe('upload fixtures', () => {
  it('are real, decodable PNGs; the large one only breaks the size rule', async () => {
    const small = await createImageBitmap(
      new Blob([pixelPng() as BlobPart], { type: 'image/png' })
    )
    expect([small.width, small.height]).toEqual([1, 1])
    const bytes = pngLargerThan(2 * 1024 * 1024)
    expect(bytes.length).toBeGreaterThan(2 * 1024 * 1024)
    const large = await createImageBitmap(
      new Blob([bytes as BlobPart], { type: 'image/png' })
    )
    expect([large.width, large.height]).toEqual([1, 1])
  })
})

describe('withUsers cleanup', () => {
  const registry: readonly Operation[] = operations
  const op = (id: string) => registry.find((o) => o.id === id)!
  const client = (deleteStatus: number, deletedCount = 1): ContractClient => ({
    csrfToken: undefined,
    forget: async () => {},
    call: async (id): Promise<ContractResponse> => ({
      operation: op(id),
      status: deleteStatus,
      headers: new Headers(),
      body:
        deleteStatus === 200
          ? { data: { deletedCount } }
          : { error: { code: 'FORBIDDEN', message: 'no' } },
    }),
  })

  it('passes when every created user is deleted', async () => {
    await expect(
      withUsers(client(200), async (ids) => void ids.push('u1'))
    ).resolves.toBeUndefined()
  })

  it('fails when the cleanup request fails or deletes fewer users', async () => {
    await expect(
      withUsers(client(403), async (ids) => void ids.push('u1'))
    ).rejects.toThrow(/batchDeleteUsers/)
    await expect(
      withUsers(client(200, 0), async (ids) => void ids.push('u1'))
    ).rejects.toThrow('deleted 0 of 1')
  })

  it('keeps the scenario failure and adds the cleanup failure to it', async () => {
    await expect(
      withUsers(client(403), async (ids) => {
        ids.push('u1')
        throw new Error('listUsers: meta.total is 2')
      })
    ).rejects.toThrow(/^listUsers: meta\.total is 2 \(cleanup also failed: /)
  })
})
