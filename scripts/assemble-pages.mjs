import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const releasePattern = /^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/
export function validateMetadata(metadata) {
  if (
    !metadata ||
    !/^[a-f0-9]{40}$/.test(metadata.commit) ||
    (metadata.version !== 'latest' && !releasePattern.test(metadata.version))
  ) {
    throw new Error('Invalid demo version or commit')
  }
  if (
    !/^\/[a-zA-Z0-9._/-]*$/.test(metadata.base) ||
    !metadata.base.endsWith('/') ||
    metadata.base.includes('..') ||
    metadata.base.includes('//')
  ) {
    throw new Error('Invalid demo base path')
  }
  return metadata
}
function plainFiles(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === '.git') continue
    const file = join(directory, entry)
    const stat = lstatSync(file)
    if (stat.isSymbolicLink())
      throw new Error(`Symlink in Pages artifact: ${file}`)
    if (stat.isDirectory()) plainFiles(file)
    else if (!stat.isFile())
      throw new Error(`Non-file in Pages artifact: ${file}`)
  }
}
const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]
  )

export function assemblePages({ buildDir, siteDir, outputDir }) {
  const paths = [buildDir, siteDir, outputDir].map((path) => resolve(path))
  for (const path of paths) {
    if (path === resolve('/') || path === process.cwd())
      throw new Error('Refusing unsafe Pages directory')
    for (const other of paths) {
      if (path !== other && path.startsWith(other + sep))
        throw new Error('Pages directories must be separate')
    }
  }
  if (new Set(paths).size !== 3)
    throw new Error('Pages directories must be separate')
  for (const path of paths) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink())
      throw new Error(`Symlink in Pages root: ${path}`)
  }
  const metadata = validateMetadata(
    JSON.parse(readFileSync(join(buildDir, 'demo.json'), 'utf8'))
  )
  plainFiles(buildDir)
  for (const required of ['index.html', 'mockServiceWorker.js']) {
    if (!lstatSync(join(buildDir, required)).isFile())
      throw new Error(`Missing ${required}`)
  }
  const latest = metadata.version === 'latest'
  const suffix = `releases/${metadata.version}/`
  if (!latest && !metadata.base.endsWith(suffix))
    throw new Error('Release base does not match its version')
  const siteBase = latest
    ? metadata.base
    : metadata.base.slice(0, -suffix.length)
  mkdirSync(siteDir, { recursive: true })
  plainFiles(siteDir)
  const releasesDir = join(siteDir, 'releases')
  const versions = existsSync(releasesDir)
    ? readdirSync(releasesDir).map((version) => {
        if (!releasePattern.test(version))
          throw new Error('Unexpected release directory')
        const entry = validateMetadata(
          JSON.parse(
            readFileSync(join(releasesDir, version, 'demo.json'), 'utf8')
          )
        )
        if (
          entry.version !== version ||
          entry.base !== `${siteBase}releases/${version}/`
        )
          throw new Error('Archived release provenance mismatch')
        return entry
      })
    : []
  const destination = latest ? siteDir : join(releasesDir, metadata.version)
  const existing = versions.find((entry) => entry.version === metadata.version)
  if (existing && existing.commit !== metadata.commit)
    throw new Error(
      'Refusing to replace an immutable release with a different commit'
    )
  if (latest) {
    for (const entry of readdirSync(siteDir)) {
      if (entry !== '.git' && entry !== 'releases')
        rmSync(join(siteDir, entry), { force: true, recursive: true })
    }
  }
  if (!existing) cpSync(buildDir, destination, { recursive: true })
  if (!latest && !existing) versions.push(metadata)
  versions.sort((a, b) =>
    b.version.localeCompare(a.version, 'en', { numeric: true })
  )
  const hasLatest = existsSync(join(siteDir, 'demo.json'))
  if (hasLatest) {
    const current = validateMetadata(
      JSON.parse(readFileSync(join(siteDir, 'demo.json'), 'utf8'))
    )
    if (current.version !== 'latest' || current.base !== siteBase)
      throw new Error('Latest demo provenance mismatch')
  }
  const index = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>演示版本 — React Admin Starter</title><body><main><h1>演示版本</h1><p>模拟数据仅保存在浏览器，请勿输入真实密码或个人信息。</p>${hasLatest ? `<p><a href="${escapeHtml(siteBase)}">最新演示</a></p>` : '<p>最新演示尚未发布。</p>'}<ul>${versions.map((entry) => `<li><a href="${escapeHtml(entry.base)}">${escapeHtml(entry.version)}</a> · ${escapeHtml(entry.commit.slice(0, 7))}</li>`).join('')}</ul></main></body></html>`
  writeFileSync(join(siteDir, 'versions.html'), index)
  writeFileSync(
    join(siteDir, 'versions.json'),
    JSON.stringify(versions, null, 2) + '\n'
  )
  if (!existsSync(join(siteDir, 'index.html')))
    writeFileSync(join(siteDir, 'index.html'), index)
  writeFileSync(join(siteDir, '.nojekyll'), '')
  rmSync(outputDir, { recursive: true, force: true })
  cpSync(siteDir, outputDir, {
    recursive: true,
    filter: (source) => basename(source) !== '.git',
  })
  return { siteBase, versions: versions.length }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [buildDir, siteDir, outputDir] = process.argv.slice(2)
  if (!buildDir || !siteDir || !outputDir)
    throw new Error('Usage: assemble-pages.mjs BUILD SITE OUTPUT')
  console.log(assemblePages({ buildDir, siteDir, outputDir }))
}
