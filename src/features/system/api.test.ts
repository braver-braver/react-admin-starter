import { operations } from '@/contract/operations'
import { systemResources } from '@/contract/permissions'
import { describe, expect, it } from 'vitest'
import { systemOperationId } from './api'

describe('system API operation ids', () => {
  it('maps every resource and action to a registry operation', () => {
    const ids = new Set<string>(operations.map((op) => op.id))
    const missing = systemResources.flatMap((resource) =>
      (['list', 'create', 'update', 'delete'] as const)
        .map((action) => systemOperationId(action, resource))
        .filter((id) => !ids.has(id))
    )
    expect(missing).toEqual([])
  })
})
