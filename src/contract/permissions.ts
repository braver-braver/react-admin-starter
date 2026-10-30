/**
 * Capability codes. Pure types and constants: the contract directory may only
 * depend on `zod` and sibling files (see operations.test.ts), so that Node can
 * load it directly when generating docs.
 */

export const systemResources = [
  'accounts',
  'roles',
  'permissions',
  'menus',
  'departments',
] as const
export type SystemResource = (typeof systemResources)[number]

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'permissions:read'
  | 'audit:read'
  | `system:${SystemResource}:${'read' | 'write'}`
