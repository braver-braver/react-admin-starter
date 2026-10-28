import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = 'dist-demo'
const metadata = JSON.parse(readFileSync(join(root, 'demo.json'), 'utf8'))
if (
  !/^[a-f0-9]{40}$/.test(metadata.commit) ||
  !metadata.version ||
  !metadata.base.startsWith('/') ||
  !metadata.base.endsWith('/')
) {
  throw new Error('Invalid demo provenance')
}
const worker = readFileSync(join(root, 'mockServiceWorker.js'), 'utf8')
if (!worker.includes('Mock Service Worker'))
  throw new Error('Missing MSW worker')
const index = readFileSync(join(root, 'index.html'), 'utf8')
if (!index.includes(`${metadata.base}assets/`))
  throw new Error('Wrong demo asset base')
const scripts = readdirSync(join(root, 'assets')).filter((file) =>
  file.endsWith('.js')
)
const content = scripts
  .map((file) => readFileSync(join(root, 'assets', file), 'utf8'))
  .join('\n')
for (const required of [
  'Demo1234!',
  'admin@example.com',
  'mock_session',
  '演示环境',
]) {
  if (!content.includes(required))
    throw new Error(`Demo bundle missing ${required}`)
}
console.log(
  `Static demo verified: ${metadata.version} @ ${metadata.commit.slice(0, 7)}, base ${metadata.base}`
)
