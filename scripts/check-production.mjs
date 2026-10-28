import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const forbidden = [
  'mockServiceWorker',
  'mock_session',
  'react-admin-starter:mock-sessions',
  'Demo1234!',
  'admin@example.com',
  'viewer@example.com',
  'guest@example.com',
]
let inspected = 0
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) inspect(path)
    else {
      inspected += 1
      if (forbidden.some((value) => entry.name.includes(value))) {
        throw new Error(`Development mock artifact found: ${path}`)
      }
      if (/\.(js|html|json|map)$/.test(entry.name)) {
        const content = readFileSync(path, 'utf8')
        if (forbidden.some((value) => content.includes(value))) {
          throw new Error(`Development mock content found: ${path}`)
        }
      }
    }
  }
}
inspect(dist)
if (!inspected) throw new Error('Production output is empty')
console.log(`Production boundary verified: ${inspected} files; no mock worker, handlers or demo credentials.`)
