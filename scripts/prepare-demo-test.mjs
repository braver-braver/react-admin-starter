import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { assemblePages } from './assemble-pages.mjs'

const root = '.demo-test'
rmSync(root, { recursive: true, force: true })
mkdirSync(root)
const siteDir = resolve(root, 'history')
const outputDir = resolve(root, 'site')
for (const version of ['latest', 'v0.0.0-smoke']) {
  const base = `/react-admin-starter/${version === 'latest' ? '' : `releases/${version}/`}`
  execFileSync('pnpm', ['build:demo'], {
    stdio: 'inherit',
    env: { ...process.env, DEMO_BASE_PATH: base, DEMO_VERSION: version },
  })
  assemblePages({ buildDir: resolve('dist-demo'), siteDir, outputDir })
}
