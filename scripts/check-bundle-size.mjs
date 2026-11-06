import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * Bundle-size budget for the ordinary production build (B9, #101). Sizes are
 * gzip (level 9) bytes, which is what a browser downloads from a typical
 * static host. The budgets are the v1.0 measurement plus about 10% headroom:
 *
 *   initial JS   154.8 KB   (entry script + every modulepreload in index.html)
 *   initial CSS   15.7 KB
 *   all JS       287.0 KB
 *   largest lazy  35.8 KB   (largest JS chunk not loaded up front)
 *
 * Raising a budget is a deliberate change: say why in the PR.
 */
export const KIB = 1024
export const budgets = {
  initialJs: 170 * KIB,
  initialCss: 18 * KIB,
  totalJs: 315 * KIB,
  largestLazyJs: 40 * KIB,
}

const labels = {
  initialJs: 'initial JS',
  initialCss: 'initial CSS',
  totalJs: 'all JS',
  largestLazyJs: 'largest lazy JS chunk',
}

const gzipSize = (path) => gzipSync(readFileSync(path), { level: 9 }).length

/** Every file below `dir`, as paths relative to it with `/` separators. */
function files(dir) {
  return readdirSync(dir, { recursive: true })
    .map((entry) => join(dir, String(entry)))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(dir, path).split(sep).join('/'))
}

/**
 * The scripts and stylesheets `index.html` loads up front. Vite writes
 * absolute URLs under its `base`; they are resolved against `dist`.
 */
export function initialAssets(html) {
  const tags = [...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map(
    ([tag]) => tag
  )
  const url = (tag, attribute) =>
    new RegExp(`\\b${attribute}="([^"]+)"`).exec(tag)?.[1]
  const assets = []
  for (const tag of tags) {
    const isScript = tag.startsWith('<script')
    const rel = /\brel="([^"]+)"/.exec(tag)?.[1]
    const href = isScript ? url(tag, 'src') : url(tag, 'href')
    if (!href || /^[a-z]+:\/\//i.test(href)) continue
    if (isScript && /\btype="module"/.test(tag)) assets.push(href)
    else if (rel === 'modulepreload' || rel === 'stylesheet') assets.push(href)
  }
  return assets
}

/** Measures the built site in `distDir`. */
export function measure(distDir, base = '/') {
  const root = resolve(distDir)
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  const toFile = (href) => {
    const path = href.startsWith(base)
      ? href.slice(base.length)
      : href.replace(/^\//, '')
    const file = resolve(root, path)
    if (!file.startsWith(root + sep) || !existsSync(file))
      throw new Error(
        `index.html references ${href}, which is not in ${distDir}`
      )
    return relative(root, file).split(sep).join('/')
  }
  const initial = new Set(initialAssets(html).map(toFile))
  const sizes = new Map(
    files(root)
      .filter((file) => /\.(js|css)$/.test(file))
      .map((file) => [file, gzipSize(join(root, file))])
  )
  const sum = (predicate) =>
    [...sizes]
      .filter(([file]) => predicate(file))
      .reduce((total, [, size]) => total + size, 0)
  const lazy = [...sizes].filter(
    ([file]) => file.endsWith('.js') && !initial.has(file)
  )
  const [largestLazyFile, largestLazyJs] = lazy.reduce(
    (largest, entry) => (entry[1] > largest[1] ? entry : largest),
    ['', 0]
  )
  return {
    initialJs: sum((file) => initial.has(file) && file.endsWith('.js')),
    initialCss: sum((file) => initial.has(file) && file.endsWith('.css')),
    totalJs: sum((file) => file.endsWith('.js')),
    largestLazyJs,
    largestLazyFile,
  }
}

/** Budget lines that are exceeded, empty when everything fits. */
export function overBudget(measured, limits = budgets) {
  return Object.entries(limits)
    .filter(([key, limit]) => measured[key] > limit)
    .map(
      ([key, limit]) =>
        `${labels[key]}: ${kib(measured[key])} > budget ${kib(limit)}`
    )
}

const kib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`

export function report(measured, limits = budgets) {
  const rows = Object.entries(limits).map(([key, limit]) => {
    const share = Math.round((measured[key] / limit) * 100)
    const file =
      key === 'largestLazyJs' && measured.largestLazyFile
        ? `  ${measured.largestLazyFile}`
        : ''
    return `  ${labels[key].padEnd(22)} ${kib(measured[key]).padStart(10)} / ${kib(limit).padStart(10)}  ${String(share).padStart(3)}%${file}`
  })
  return ['Bundle size (gzip):', ...rows].join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const measured = measure(
    process.argv[2] ?? 'dist',
    process.env.BASE_PATH ?? '/'
  )
  console.log(report(measured))
  const failures = overBudget(measured)
  if (failures.length) {
    console.error(
      `Bundle size budget exceeded:\n${failures.map((line) => `  ${line}`).join('\n')}`
    )
    process.exit(1)
  }
  console.log('Bundle size within budget.')
}
