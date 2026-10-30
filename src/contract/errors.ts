/**
 * Every `error.code` the API may return, with its HTTP status and meaning.
 *
 * Inventory of what the reference mock returns today; a real backend must use
 * the same codes. Adding a code is backward compatible, removing or renaming
 * one is breaking (see the freeze rules planned in M1-T9).
 */

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422

type ErrorEntry = {
  /** HTTP statuses the code may be returned with. */
  status: readonly ErrorStatus[]
  /**
   * `operation`: declared per operation in the registry.
   * `routing`: returned for requests that match no registered operation.
   */
  scope: 'operation' | 'routing'
  meaning: string
}

export const errorCatalog = {
  UNAUTHENTICATED: {
    status: [401],
    scope: 'operation',
    meaning: 'No valid session: missing, expired, revoked or unknown cookie.',
  },
  INVALID_CREDENTIALS: {
    status: [401],
    scope: 'operation',
    meaning: 'Login failed: unknown email or wrong password.',
  },
  INVALID_REQUEST: {
    status: [400],
    scope: 'operation',
    meaning: 'The request body is not valid JSON.',
  },
  INVALID_CREDENTIALS_FORMAT: {
    status: [400],
    scope: 'operation',
    meaning: 'Login body does not contain a valid email and password.',
  },
  REQUEST_HEADER_REQUIRED: {
    status: [403],
    scope: 'operation',
    meaning: 'Missing `X-Requested-With: ReactAdminStarter` header.',
  },
  INVALID_CSRF_TOKEN: {
    status: [403],
    scope: 'operation',
    meaning: 'Missing or mismatching `X-CSRF-Token` on an authenticated write.',
  },
  FORBIDDEN: {
    status: [403],
    scope: 'operation',
    meaning: 'The session lacks the capability the operation requires.',
  },
  DATA_SCOPE_DENIED: {
    status: [403],
    scope: 'operation',
    meaning:
      'The record, or a record in a batch, is outside the actor data scope. Batches are rejected atomically.',
  },
  USER_NOT_FOUND: {
    status: [404],
    scope: 'operation',
    meaning: 'No user with the given id.',
  },
  INVALID_USER_FIELDS: {
    status: [422],
    scope: 'operation',
    meaning: 'A required user field is empty, or email/role is invalid.',
  },
  DUPLICATE_USER: {
    status: [422],
    scope: 'operation',
    meaning: 'Email or username already exists.',
  },
  INVALID_STATUS: {
    status: [422],
    scope: 'operation',
    meaning: 'Bulk status must be `active` or `inactive`.',
  },
  INVALID_EMAIL: {
    status: [422],
    scope: 'operation',
    meaning: 'Invitation email is not a valid address.',
  },
  INVALID_ROLE: {
    status: [422],
    scope: 'operation',
    meaning: 'Role is not one of the allowed values.',
  },
  FILE_REQUIRED: {
    status: [422],
    scope: 'operation',
    meaning: 'Upload has no `file` part.',
  },
  UNSUPPORTED_FILE_TYPE: {
    status: [422],
    scope: 'operation',
    meaning: 'Only image uploads are accepted.',
  },
  FILE_TOO_LARGE: {
    status: [422],
    scope: 'operation',
    meaning: 'Upload exceeds 2 MB.',
  },
  INVALID_FIELDS: {
    status: [422],
    scope: 'operation',
    meaning: 'A system-management body failed schema validation.',
  },
  SYSTEM_RULE: {
    status: [401, 403, 404, 409, 422],
    scope: 'operation',
    meaning:
      'A system-management business rule rejected the change: stale session (401), delegation or scope limits (403), unknown record (404), protected record, duplicate or still-referenced record (409), invalid reference or hierarchy (422).',
  },
  NOT_FOUND: {
    status: [404],
    scope: 'routing',
    meaning: 'Unknown system resource or unsupported path.',
  },
  INVALID_METHOD: {
    status: [400],
    scope: 'routing',
    meaning: 'HTTP method does not match the resource path.',
  },
} as const satisfies Record<string, ErrorEntry>

export type ErrorCode = keyof typeof errorCatalog

/** Error codes that may be sent with HTTP status `S`. Distributes over unions. */
export type ErrorCodeFor<S extends ErrorStatus> = {
  [C in ErrorCode]: S extends (typeof errorCatalog)[C]['status'][number]
    ? C
    : never
}[ErrorCode]

/** Declared errors of an operation: status → allowed codes for that status. */
export type DeclaredErrors = {
  [S in ErrorStatus]?: readonly ErrorCodeFor<S>[]
}
