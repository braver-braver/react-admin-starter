#!/usr/bin/env node
// Writes docs/api.openapi.json from the Zod contract (src/contract).
//   pnpm contract:generate   write the file
//   pnpm contract:check      fail if the committed file differs from the contract
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

if (!process.features?.typescript) {
  console.error(
    `contract: Node ${process.versions.node} cannot load the TypeScript contract directly. ` +
      'Use Node 22.18 or later (native type stripping), e.g. `mise use node@22`.'
  )
  process.exit(1)
}

const root = new URL('../', import.meta.url)
const target = fileURLToPath(new URL('docs/api.openapi.json', root))
const { version } = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8')
)
const { buildOpenApi } = await import('../src/contract/openapi.ts')
const generated = `${JSON.stringify(buildOpenApi({ version }), null, 2)}\n`

if (process.argv.includes('--check')) {
  const committed = await readFile(target, 'utf8').catch(() => '')
  if (committed !== generated) {
    console.error(
      'contract: docs/api.openapi.json is out of date with src/contract. Run `pnpm contract:generate` and commit the result.'
    )
    process.exit(1)
  }
  console.log('contract: docs/api.openapi.json matches src/contract.')
} else {
  await writeFile(target, generated)
  console.log('contract: wrote docs/api.openapi.json')
}
