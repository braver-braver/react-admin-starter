// Static files only: no SPA fallback that could hide a broken Pages deep link.
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const root = resolve(process.env.DEMO_SERVE_DIR ?? '.demo-test/site')
const base = process.env.DEMO_SERVE_BASE ?? '/react-admin-starter/'
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname
    )
    if (!pathname.startsWith(base)) throw new Error('Outside site')
    let file = resolve(root, pathname.slice(base.length) || '.')
    if (file !== root && !file.startsWith(root + sep))
      throw new Error('Outside site')
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html')
    response.setHeader(
      'Content-Type',
      mime[extname(file)] ?? 'application/octet-stream'
    )
    response.setHeader('Cache-Control', 'no-store')
    response.end(await readFile(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(5192, '127.0.0.1')
