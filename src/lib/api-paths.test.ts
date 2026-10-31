import { describe, expect, it } from 'vitest'

/**
 * M1-T7: requests go through `callOperation`, which takes method and path from
 * the contract registry. Outside the transport layer (`lib/api.ts`), the
 * contract, the mock and tests, source code must not build API paths by hand.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const allowed = [
  /^\/src\/lib\/api\.ts$/,
  /^\/src\/contract\//,
  /^\/src\/mocks\//,
  /\.test\.tsx?$/,
  /^\/src\/routeTree\.gen\.ts$/,
]

describe('no hand-written API requests', () => {
  const files = Object.entries(sources).filter(
    ([path]) => !allowed.some((pattern) => pattern.test(path))
  )

  it('scans the application sources', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('does not call apiRequest or fetch an /api path directly', () => {
    const offenders = files.flatMap(([path, text]) => {
      const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      return [
        ...(/\bapiRequest\s*\(/.test(code) ? [`${path}: apiRequest(`] : []),
        ...(/['"`]\/api\//.test(code) ? [`${path}: '/api/' literal`] : []),
        ...(/\bfetch\s*\(/.test(code) ? [`${path}: fetch(`] : []),
      ]
    })
    expect(offenders).toEqual([])
  })
})
