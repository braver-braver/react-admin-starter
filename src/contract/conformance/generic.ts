import { type Operation, type OperationId } from '../operations.ts'
import { expectError } from './assert.ts'
import { type CallArgs } from './client.ts'
import type { Scenario } from './scenarios.ts'

/**
 * Scenarios derived from the registry, so a new operation is covered without
 * writing anything: missing source header, no session, no capability, no
 * CSRF token. Each request is rejected during the access checks, before the
 * body is looked at, so the placeholder arguments change nothing.
 */

const PLACEHOLDER_ID = 'conformance-missing-id'

/** Arguments that reach the access checks: every path parameter, a body. */
export function placeholderArgs(op: Operation): CallArgs {
  const names = [...op.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
  return {
    ...(names.length
      ? {
          params: Object.fromEntries(
            names.map((name) => [name, PLACEHOLDER_ID])
          ),
        }
      : {}),
    ...(op.multipart ? { body: new FormData() } : op.body ? { body: {} } : {}),
  }
}

export function genericScenarios(registry: readonly Operation[]): Scenario[] {
  const list: Scenario[] = []
  for (const op of registry) {
    const args = placeholderArgs(op)
    if (op.method !== 'GET') {
      list.push({
        name: `generic: ${op.id} without X-Requested-With → 403 REQUEST_HEADER_REQUIRED`,
        tier: 1,
        async run(client) {
          const response = await client.call(op.id as OperationId, {
            ...args,
            headers: { 'X-Requested-With': undefined },
          })
          expectError(response, 403, 'REQUEST_HEADER_REQUIRED')
        },
      })
    }
    if (op.auth === 'session') {
      list.push({
        name: `generic: ${op.id} without a session → 401 UNAUTHENTICATED`,
        tier: 1,
        async run(client) {
          expectError(
            await client.call(op.id as OperationId, args),
            401,
            'UNAUTHENTICATED'
          )
        },
      })
    }
    if (op.permission) {
      list.push({
        name: `generic: ${op.id} as guest (no capability) → 403 FORBIDDEN`,
        tier: 1,
        async run(client, { guest }) {
          await client.call('login', { body: guest })
          expectError(
            await client.call(op.id as OperationId, args),
            403,
            'FORBIDDEN'
          )
        },
      })
    }
    if (op.csrf) {
      list.push({
        name: `generic: ${op.id} without X-CSRF-Token → 403 INVALID_CSRF_TOKEN`,
        tier: 1,
        async run(client, { admin }) {
          await client.call('login', { body: admin })
          const response = await client.call(op.id as OperationId, {
            ...args,
            headers: { 'X-CSRF-Token': undefined },
          })
          expectError(response, 403, 'INVALID_CSRF_TOKEN')
        },
      })
    }
  }
  return list
}
