import { z } from 'zod'
import { auditListResponseSchema } from './audit.ts'
import { loginSchema, permissionsSchema, sessionSchema } from './auth.ts'
import { successSchema } from './common.ts'
import type { DeclaredErrors } from './errors.ts'
import type { Permission, SystemResource } from './permissions.ts'
import {
  accountInput,
  accountSchema,
  departmentInput,
  departmentSchema,
  menuInput,
  menuSchema,
  navigationSchema,
  optionsSchema,
  permissionInput,
  permissionSchema,
  roleInput,
  roleSchema,
  systemListOf,
} from './system.ts'
import { uploadFileSchema } from './uploads.ts'
import { userListResponseSchema, userSchema } from './users.ts'

/**
 * Operation registry: the single list of every HTTP operation of the API.
 *
 * It mirrors what the reference mock does today (M1-T1 changes no behaviour).
 * Later tasks build on it: request schemas for users/invite/ids/status/queries
 * (M1-T4, #30), OpenAPI generation (M1-T5, #31), the typed client (M1-T7, #33)
 * and the mock response guard (M1-T8, #34).
 *
 * Paths are relative to `/api` and use OpenAPI `{param}` syntax.
 */
export type Operation = {
  /** operationId; unique. */
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: `/${string}`
  summary: string
  /** Required capability. An array means "any one of". Absent: no capability needed. */
  permission?: Permission | readonly Permission[]
  /** `session`: needs a valid session cookie. `none`: callable anonymously. */
  auth: 'none' | 'session'
  /** Needs `X-CSRF-Token` matching the session. */
  csrf: boolean
  params?: z.ZodType
  /** JSON request body schema. Absent when not modelled yet or not JSON. */
  body?: z.ZodType
  /** Body is `multipart/form-data` (the `file` part). */
  multipart?: true
  success: { status: 200 | 201; schema: z.ZodType }
  errors: DeclaredErrors
}

const idParams = z.object({ id: z.string() })

// Error sets shared by many operations; see errors.ts for meanings.
const anyUser = { 401: ['UNAUTHENTICATED'] } as const
const guarded = {
  ...anyUser,
  403: ['FORBIDDEN'],
} as const satisfies DeclaredErrors
const guardedWrite = {
  ...anyUser,
  403: ['FORBIDDEN', 'INVALID_CSRF_TOKEN'],
} as const satisfies DeclaredErrors
const scopedWrite = {
  ...anyUser,
  403: ['FORBIDDEN', 'INVALID_CSRF_TOKEN', 'DATA_SCOPE_DENIED'],
} as const satisfies DeclaredErrors

const systemReadPermissions: readonly Permission[] = [
  'system:accounts:read',
  'system:roles:read',
  'system:permissions:read',
  'system:menus:read',
  'system:departments:read',
]

function systemOperations<R extends z.ZodType, I extends z.ZodType>(
  resource: SystemResource,
  name: string,
  record: R,
  input: I
): Operation[] {
  const collection = `/system/${resource}` as const
  const member = `/system/${resource}/{id}` as const
  const write = `system:${resource}:write` as const
  return [
    {
      id: `listSystem${name}s`,
      method: 'GET',
      path: collection,
      summary: `List ${resource}`,
      permission: `system:${resource}:read`,
      auth: 'session',
      csrf: false,
      success: { status: 200, schema: systemListOf(record) },
      errors: guarded,
    },
    {
      id: `createSystem${name}`,
      method: 'POST',
      path: collection,
      summary: `Create ${resource} record`,
      permission: write,
      auth: 'session',
      csrf: true,
      body: input,
      success: { status: 201, schema: record },
      errors: {
        401: ['UNAUTHENTICATED', 'SYSTEM_RULE'],
        403: ['FORBIDDEN', 'INVALID_CSRF_TOKEN', 'SYSTEM_RULE'],
        409: ['SYSTEM_RULE'],
        422: ['INVALID_FIELDS', 'SYSTEM_RULE'],
      },
    },
    {
      id: `updateSystem${name}`,
      method: 'PUT',
      path: member,
      summary: `Update ${resource} record`,
      permission: write,
      auth: 'session',
      csrf: true,
      params: idParams,
      body: input,
      success: { status: 200, schema: record },
      errors: {
        401: ['UNAUTHENTICATED', 'SYSTEM_RULE'],
        403: ['FORBIDDEN', 'INVALID_CSRF_TOKEN', 'SYSTEM_RULE'],
        404: ['SYSTEM_RULE'],
        409: ['SYSTEM_RULE'],
        422: ['INVALID_FIELDS', 'SYSTEM_RULE'],
      },
    },
    {
      id: `deleteSystem${name}`,
      method: 'DELETE',
      path: member,
      summary: `Delete ${resource} record`,
      permission: write,
      auth: 'session',
      csrf: true,
      params: idParams,
      success: { status: 200, schema: successSchema },
      errors: {
        401: ['UNAUTHENTICATED', 'SYSTEM_RULE'],
        403: ['FORBIDDEN', 'INVALID_CSRF_TOKEN', 'SYSTEM_RULE'],
        404: ['SYSTEM_RULE'],
        409: ['SYSTEM_RULE'],
      },
    },
  ]
}

export const operations: readonly Operation[] = [
  // --- auth (6 incl. navigation)
  {
    id: 'login',
    method: 'POST',
    path: '/auth/login',
    summary: 'Sign in and start a cookie session',
    auth: 'none',
    csrf: false,
    body: loginSchema,
    success: { status: 200, schema: sessionSchema },
    errors: {
      400: ['INVALID_REQUEST', 'INVALID_CREDENTIALS_FORMAT'],
      401: ['INVALID_CREDENTIALS'],
      403: ['REQUEST_HEADER_REQUIRED'],
    },
  },
  {
    id: 'getSession',
    method: 'GET',
    path: '/auth/session',
    summary: 'Validate the current session and return identity and grants',
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: sessionSchema },
    errors: anyUser,
  },
  {
    id: 'logout',
    method: 'POST',
    path: '/auth/logout',
    summary: 'Revoke the session and clear the cookie',
    auth: 'session',
    csrf: true,
    success: { status: 200, schema: successSchema },
    errors: {
      401: ['UNAUTHENTICATED'],
      403: ['REQUEST_HEADER_REQUIRED', 'INVALID_CSRF_TOKEN'],
    },
  },
  {
    id: 'getPermissions',
    method: 'GET',
    path: '/auth/permissions',
    summary: 'Roles and permissions of the current account',
    permission: 'permissions:read',
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: permissionsSchema },
    errors: guarded,
  },
  {
    id: 'getNavigation',
    method: 'GET',
    path: '/auth/navigation',
    summary: 'Enabled and authorized menus of the current account',
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: navigationSchema },
    errors: anyUser,
  },
  // --- system reference options
  {
    id: 'getSystemOptions',
    method: 'GET',
    path: '/system/options',
    summary: 'Reference records the actor may read, for pickers',
    permission: systemReadPermissions,
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: optionsSchema },
    errors: guarded,
  },
  // --- users
  {
    id: 'listUsers',
    method: 'GET',
    path: '/users',
    summary: 'List users (server-side paging, filtering, sorting)',
    permission: 'users:read',
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: userListResponseSchema },
    errors: guarded,
  },
  {
    id: 'createUser',
    method: 'POST',
    path: '/users',
    summary: 'Create a user',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    success: { status: 201, schema: userSchema },
    errors: { ...scopedWrite, 422: ['INVALID_USER_FIELDS', 'DUPLICATE_USER'] },
  },
  {
    id: 'updateUser',
    method: 'PUT',
    path: '/users/{id}',
    summary: 'Update a user',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    params: idParams,
    success: { status: 200, schema: userSchema },
    errors: {
      ...scopedWrite,
      404: ['USER_NOT_FOUND'],
      422: ['INVALID_USER_FIELDS', 'DUPLICATE_USER'],
    },
  },
  {
    id: 'deleteUser',
    method: 'DELETE',
    path: '/users/{id}',
    summary: 'Delete a user',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    params: idParams,
    success: { status: 200, schema: successSchema },
    errors: { ...scopedWrite, 404: ['USER_NOT_FOUND'] },
  },
  {
    id: 'batchDeleteUsers',
    method: 'POST',
    path: '/users/batch-delete',
    summary: 'Delete the selected users atomically',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    success: {
      status: 200,
      schema: z.object({ deletedCount: z.number() }),
    },
    errors: scopedWrite,
  },
  {
    id: 'updateUsersStatus',
    method: 'PATCH',
    path: '/users/status',
    summary: 'Enable or disable the selected users atomically',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    success: {
      status: 200,
      schema: z.object({ updatedCount: z.number() }),
    },
    errors: { ...scopedWrite, 422: ['INVALID_STATUS'] },
  },
  {
    id: 'inviteUser',
    method: 'POST',
    path: '/users/invite',
    summary: 'Invite one user',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    success: { status: 201, schema: userSchema },
    errors: {
      ...scopedWrite,
      422: ['INVALID_EMAIL', 'INVALID_ROLE', 'DUPLICATE_USER'],
    },
  },
  {
    id: 'inviteUsersBatch',
    method: 'POST',
    path: '/users/invite-batch',
    summary: 'Invite the selected users atomically',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    success: {
      status: 200,
      schema: z.object({ invitedCount: z.number() }),
    },
    errors: scopedWrite,
  },
  // --- uploads
  {
    id: 'uploadFile',
    method: 'POST',
    path: '/uploads',
    summary: 'Upload an image (multipart `file`, at most 2 MB)',
    permission: 'users:write',
    auth: 'session',
    csrf: true,
    multipart: true,
    success: { status: 200, schema: uploadFileSchema },
    errors: {
      ...guardedWrite,
      422: ['FILE_REQUIRED', 'UNSUPPORTED_FILE_TYPE', 'FILE_TOO_LARGE'],
    },
  },
  // --- audit
  {
    id: 'listAuditLogs',
    method: 'GET',
    path: '/audit-logs',
    summary: 'List audit records, newest first',
    permission: 'audit:read',
    auth: 'session',
    csrf: false,
    success: { status: 200, schema: auditListResponseSchema },
    errors: guarded,
  },
  // --- system management: 5 resources x (list, create, update, delete)
  ...systemOperations('accounts', 'Account', accountSchema, accountInput),
  ...systemOperations('roles', 'Role', roleSchema, roleInput),
  ...systemOperations(
    'permissions',
    'Permission',
    permissionSchema,
    permissionInput
  ),
  ...systemOperations('menus', 'Menu', menuSchema, menuInput),
  ...systemOperations(
    'departments',
    'Department',
    departmentSchema,
    departmentInput
  ),
]
