import { describe, expect, it } from 'vitest'

/**
 * Stopgap guard for the hand-written docs/api.openapi.yaml: system-management
 * responses must stay open to new fields and request bodies strict, like the
 * Zod contract. Delete together with the YAML once M1-T5 generates the document.
 */
const sources = import.meta.glob('/docs/api.openapi.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const yaml = Object.values(sources)[0] ?? ''

function schemaBlock(name: string): string {
  const match = yaml.match(
    new RegExp(`^ {4}${name}:\\n((?: {5,}.*\\n|\\n)+)`, 'm')
  )
  if (!match)
    throw new Error(`schema ${name} not found in docs/api.openapi.yaml`)
  return match[1]
}

const strict = /^ {6}additionalProperties: false$/m
const responses = [
  'SystemAccount',
  'SystemRole',
  'SystemPermission',
  'SystemMenu',
  'SystemDepartment',
  'SystemList',
  'SystemOptions',
]
const requests = [
  'SystemAccountWrite',
  'SystemRoleWrite',
  'SystemPermissionWrite',
  'SystemMenuWrite',
  'SystemDepartmentWrite',
]

describe('docs/api.openapi.yaml system schemas', () => {
  it('found the document', () => {
    expect(yaml.length).toBeGreaterThan(1000)
  })

  it.each(responses)(
    '%s (response) allows fields added by a backend',
    (name) => {
      expect(schemaBlock(name)).not.toMatch(strict)
    }
  )

  it.each(requests)('%s (request body) rejects unknown fields', (name) => {
    expect(schemaBlock(name)).toMatch(strict)
  })
})
