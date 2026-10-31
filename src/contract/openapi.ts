import { z } from 'zod'
import { auditListResponseSchema, auditLogSchema } from './audit.ts'
import { loginSchema, permissionsSchema, sessionSchema } from './auth.ts'
import {
  API_PREFIX,
  idListSchema,
  pageMetaSchema,
  successSchema,
} from './common.ts'
import { errorCatalog, type ErrorCode } from './errors.ts'
import { type Operation, operations } from './operations.ts'
import {
  accountCreateInput,
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
  systemRecordSchema,
} from './system.ts'
import { uploadFileSchema } from './uploads.ts'
import {
  deletedCountSchema,
  invitedCountSchema,
  updatedCountSchema,
  userInviteSchema,
  userListResponseSchema,
  userSchema,
  userStatusUpdateSchema,
  userWriteSchema,
} from './users.ts'

/**
 * OpenAPI 3.1 document generated from the contract: the registry gives paths,
 * methods, auth, headers and declared errors; the Zod schemas give bodies.
 * Pure (no I/O) so tests can call it; `scripts/generate-openapi.mjs` writes
 * `docs/api.openapi.json` and `--check` fails CI when it drifts.
 *
 * Schemas are emitted with `io: 'input'`, i.e. as they travel on the wire:
 * a `wireDate` is an ISO 8601 string, not the decoded `Date`.
 */

type Json = Record<string, unknown>

/** Every request and response body gets a component name. */
const namedSchemas: readonly (readonly [z.ZodType, string])[] = [
  [loginSchema, 'LoginRequest'],
  [sessionSchema, 'Session'],
  [permissionsSchema, 'Permissions'],
  [successSchema, 'Success'],
  [idListSchema, 'IdList'],
  [pageMetaSchema, 'PageMeta'],
  [uploadFileSchema, 'UploadedFile'],
  [userSchema, 'User'],
  [userListResponseSchema, 'UserList'],
  [userWriteSchema, 'UserWrite'],
  [userInviteSchema, 'UserInvite'],
  [userStatusUpdateSchema, 'UserStatusUpdate'],
  [deletedCountSchema, 'DeletedCount'],
  [updatedCountSchema, 'UpdatedCount'],
  [invitedCountSchema, 'InvitedCount'],
  [auditLogSchema, 'AuditLog'],
  [auditListResponseSchema, 'AuditList'],
  [accountSchema, 'SystemAccount'],
  [roleSchema, 'SystemRole'],
  [permissionSchema, 'SystemPermission'],
  [menuSchema, 'SystemMenu'],
  [departmentSchema, 'SystemDepartment'],
  [systemRecordSchema, 'SystemRecord'],
  [optionsSchema, 'SystemOptions'],
  [navigationSchema, 'Navigation'],
  [accountCreateInput, 'SystemAccountCreate'],
  [accountInput, 'SystemAccountUpdate'],
  [roleInput, 'SystemRoleWrite'],
  [permissionInput, 'SystemPermissionWrite'],
  [menuInput, 'SystemMenuWrite'],
  [departmentInput, 'SystemDepartmentWrite'],
]

const SAFE_INTEGER_BOUNDS = new Set([
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
])

/**
 * Drops what Zod adds but OpenAPI readers do not need: `$schema`/`$id`, the
 * safe-integer bounds of `.int()`, and the long regex behind `date-time`
 * (the format already says it).
 */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean)
  if (!value || typeof value !== 'object') return value
  const out: Json = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === '$schema' || key === '$id') continue
    if (
      (key === 'maximum' || key === 'minimum') &&
      SAFE_INTEGER_BOUNDS.has(child as number)
    )
      continue
    out[key] = clean(child)
  }
  if (out.format === 'date-time') delete out.pattern
  return out
}

const toJson = (schema: z.ZodType) =>
  clean(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })) as Json

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

/** Component name of an operation's body or success schema. */
function componentName(
  names: Map<z.ZodType, string>,
  op: Operation,
  schema: z.ZodType
): string {
  const known = names.get(schema)
  if (known) return known
  // System lists are built per resource by systemListOf(record).
  const list = /^listSystem(\w+)s$/.exec(op.id)
  if (list && schema === op.success.schema) return `System${list[1]}List`
  throw new Error(`No component name for a schema of operation ${op.id}`)
}

function errorResponse(codes: readonly ErrorCode[]) {
  return {
    description: codes
      .map((code) => `\`${code}\`: ${errorCatalog[code].meaning}`)
      .join('\n\n'),
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', enum: [...codes] },
                message: {
                  type: 'string',
                  description: 'Human-readable message (Chinese by default).',
                },
              },
            },
          },
        },
      },
    },
  }
}

function queryParameters(schema: z.ZodType) {
  const json = toJson(schema)
  const properties = (json.properties ?? {}) as Record<string, Json>
  const required = new Set((json.required ?? []) as string[])
  return Object.entries(properties).map(([name, property]) => {
    const { description, ...propertySchema } = property
    return {
      name,
      in: 'query',
      required: required.has(name),
      ...(description ? { description } : {}),
      ...(property.type === 'array' ? { style: 'form', explode: true } : {}),
      schema: propertySchema,
    }
  })
}

function permissionText(op: Operation): string | undefined {
  if (!op.permission) return undefined
  const list =
    typeof op.permission === 'string' ? [op.permission] : op.permission
  return list.length === 1
    ? `Requires \`${list[0]}\`.`
    : `Requires any one of ${list.map((p) => `\`${p}\``).join(', ')}.`
}

function operationObject(op: Operation, names: Map<z.ZodType, string>): Json {
  const parameters: Json[] = []
  for (const match of op.path.matchAll(/\{(\w+)\}/g)) {
    parameters.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })
  }
  if (op.query) parameters.push(...queryParameters(op.query))
  if (op.method !== 'GET')
    parameters.push({ $ref: '#/components/parameters/RequestedWith' })
  if (op.csrf) parameters.push({ $ref: '#/components/parameters/CsrfToken' })

  const responses: Json = {
    [op.success.status]: {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['data'],
            properties: {
              data: ref(componentName(names, op, op.success.schema)),
            },
          },
        },
      },
    },
  }
  for (const [status, codes] of Object.entries(op.errors)) {
    if (codes?.length) responses[status] = errorResponse(codes)
  }

  const requestBody = op.multipart
    ? {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      }
    : op.body
      ? {
          required: true,
          content: {
            'application/json': {
              schema: ref(componentName(names, op, op.body)),
            },
          },
        }
      : undefined

  const description = permissionText(op)
  return {
    operationId: op.id,
    summary: op.summary,
    ...(description ? { description } : {}),
    tags: [op.path.split('/')[1]],
    security: op.auth === 'none' ? [] : [{ sessionCookie: [] }],
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  }
}

export function buildOpenApi({ version }: { version: string }): Json {
  const registry = z.registry<{ id: string }>()
  const names = new Map<z.ZodType, string>()
  for (const [schema, name] of namedSchemas) {
    registry.add(schema, { id: name })
    names.set(schema, name)
  }
  for (const op of operations) {
    const list = /^listSystem(\w+)s$/.exec(op.id)
    if (list) {
      const name = `System${list[1]}List`
      registry.add(op.success.schema, { id: name })
      names.set(op.success.schema, name)
    }
  }
  const generated = z.toJSONSchema(registry, {
    io: 'input',
    unrepresentable: 'any',
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, unknown> }
  const schemas = clean(generated.schemas) as Json

  const codes = Object.keys(errorCatalog) as ErrorCode[]
  schemas.ErrorCode = {
    type: 'string',
    enum: codes,
    description: codes
      .map(
        (code) =>
          `\`${code}\` (${errorCatalog[code].status.join(', ')}): ${errorCatalog[code].meaning}`
      )
      .join('\n\n'),
  }

  const paths: Record<string, Json> = {}
  for (const op of operations as readonly Operation[]) {
    paths[op.path] ??= {}
    paths[op.path][op.method.toLowerCase()] = operationObject(op, names)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'React Admin Starter API',
      version,
      description:
        'Same-origin cookie sessions. Generated from src/contract by `pnpm contract:generate`; do not edit by hand. Every write must send `X-Requested-With: ReactAdminStarter`; authenticated writes also send `X-CSRF-Token`. Development MSW is a demonstration only.',
    },
    servers: [{ url: API_PREFIX }],
    security: [{ sessionCookie: [] }],
    paths,
    components: {
      schemas,
      parameters: {
        RequestedWith: {
          name: 'X-Requested-With',
          in: 'header',
          required: true,
          description:
            'Required on every write; missing it returns 403 REQUEST_HEADER_REQUIRED before any session check.',
          schema: { type: 'string', enum: ['ReactAdminStarter'] },
        },
        CsrfToken: {
          name: 'X-CSRF-Token',
          in: 'header',
          required: true,
          description: 'The `csrfToken` issued with the session.',
          schema: { type: 'string' },
        },
      },
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description:
            'Production server session, HttpOnly and Secure. The development mock uses its own cookie.',
        },
      },
    },
  }
}
