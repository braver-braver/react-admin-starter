import { describe, expect, it } from 'vitest'
import { type Operation, operations } from '../operations.ts'
import { genericScenarios } from './generic.ts'
import { scenarios } from './scenarios.ts'

const registry: readonly Operation[] = operations
const generic = genericScenarios(registry)
const named = (rule: string) => generic.filter((s) => s.name.includes(rule))

describe('registry-derived scenarios (M2-T2)', () => {
  it('covers every operation with at least one generic scenario', () => {
    const uncovered = registry.filter(
      (op) => !generic.some((s) => s.name.startsWith(`generic: ${op.id} `))
    )
    expect(uncovered.map((op) => op.id)).toEqual([])
  })

  it('creates one scenario per matching operation and rule', () => {
    expect(named('REQUEST_HEADER_REQUIRED')).toHaveLength(
      registry.filter((op) => op.method !== 'GET').length
    )
    expect(named('UNAUTHENTICATED')).toHaveLength(
      registry.filter((op) => op.auth === 'session').length
    )
    expect(named('FORBIDDEN')).toHaveLength(
      registry.filter((op) => op.permission).length
    )
    expect(named('INVALID_CSRF_TOKEN')).toHaveLength(
      registry.filter((op) => op.csrf).length
    )
  })

  it('grows with the registry: a new operation gets its scenarios for free', () => {
    const extra: Operation = {
      ...registry.find((op) => op.id === 'createUser')!,
      id: 'createWidget',
      path: '/widgets',
    }
    const names = genericScenarios([...registry, extra])
      .filter((s) => s.name.startsWith('generic: createWidget '))
      .map((s) => s.name.split(' → ')[1])
    expect(names.sort()).toEqual([
      '401 UNAUTHENTICATED',
      '403 FORBIDDEN',
      '403 INVALID_CSRF_TOKEN',
      '403 REQUEST_HEADER_REQUIRED',
    ])
  })

  it('registers the generic scenarios in the suite as Tier 1', () => {
    const registered = scenarios.filter((s) => s.name.startsWith('generic: '))
    expect(registered).toHaveLength(generic.length)
    expect(registered.every((s) => s.tier === 1)).toBe(true)
  })
})
