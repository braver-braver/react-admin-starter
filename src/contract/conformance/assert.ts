import { type z } from 'zod'
import { type ErrorCode } from '../errors.ts'
import { type OperationId, type operations } from '../operations.ts'
import { checkResponse } from './check.ts'
import { type ContractResponse } from './client.ts'

/** Thrown by scenarios; runners report its message as the failure reason. */
export class ContractAssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractAssertionError'
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ContractAssertionError(message)
}

type DataOf<Id extends OperationId> = z.output<
  Extract<(typeof operations)[number], { id: Id }>['success']['schema']
>

const label = (response: ContractResponse) =>
  `${response.operation.id} (${response.operation.method} ${response.operation.path}) → ${response.status}`

/** The response matches the contract, whatever its status. */
export function expectEnvelope(response: ContractResponse) {
  const result = checkResponse(
    response.operation,
    response.status,
    response.body
  )
  if (!result.ok)
    throw new ContractAssertionError(`${label(response)}: ${result.problem}`)
  return result
}

/**
 * A success response of operation `id` matching the contract; returns its
 * parsed `data`, typed from the registry.
 */
export function expectSuccess<Id extends OperationId>(
  response: ContractResponse,
  id: Id
): DataOf<Id> {
  assert(
    response.operation.id === id,
    `expected a response of ${id}, got ${response.operation.id}`
  )
  const result = expectEnvelope(response)
  if (result.kind !== 'success') {
    throw new ContractAssertionError(
      `${label(response)}: expected ${response.operation.success.status}, got error ${result.code}`
    )
  }
  return result.data as DataOf<Id>
}

/** An error response with exactly this status and declared code. */
export function expectError(
  response: ContractResponse,
  status: number,
  code: ErrorCode
) {
  assert(
    response.status === status,
    `${label(response)}: expected status ${status}`
  )
  const result = expectEnvelope(response)
  assert(
    result.kind === 'error' && result.code === code,
    `${label(response)}: expected error ${code}`
  )
}
