import { describe, expect, it } from 'vitest'
import { API_PREFIX } from './common.ts'

/**
 * Stopgap guard for the hand-written docs/api.openapi.yaml. Every write
 * operation must declare the X-Requested-With header; system-management
 * responses must stay open to new fields and request bodies strict, like the
 * Zod contract. Delete together with the YAML once M1-T5 generates the document.
 */
const sources = import.meta.glob('/docs/api.openapi.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const yaml = Object.values(sources)[0] ?? ''
const packageJson = Object.values(
  import.meta.glob('/package.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

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

  it('declares the X-Requested-With header on every write operation', () => {
    const lines = yaml.split('\n')
    const end = lines.findIndex((line) => line.startsWith('components:'))
    const starts: { at: number; label: string }[] = []
    let path = ''
    lines.slice(0, end).forEach((line, at) => {
      const route = line.match(/^ {2}(\/\S*):\s*$/)
      if (route) path = route[1]
      const method = line.match(/^ {4}(get|post|put|patch|delete):\s*$/)
      if (method && method[1] !== 'get')
        starts.push({ at, label: `${method[1].toUpperCase()} ${path}` })
    })
    const operationStarts = lines
      .slice(0, end)
      .flatMap((line, at) =>
        /^ {4}(get|post|put|patch|delete):\s*$/.test(line) ? [at] : []
      )
    expect(starts.length).toBeGreaterThanOrEqual(13)
    for (const { at, label } of starts) {
      const next = operationStarts.find((other) => other > at) ?? end
      expect(lines.slice(at, next).join('\n'), label).toMatch(
        /parameters\/RequestedWith/
      )
    }
  })

  it('uses the package version as info.version and API_PREFIX as the server URL', () => {
    const { version } = JSON.parse(packageJson) as { version: string }
    const info = yaml.match(/^info:\n((?: {2}.*\n)+)/m)?.[1] ?? ''
    expect(info.split('\n')).toContain(`  version: ${version}`)
    const servers = yaml.match(/^servers:\n((?: {2}.*\n)+)/m)?.[1] ?? ''
    expect(servers.split('\n')).toContain(`  - url: ${API_PREFIX}`)
  })
})
