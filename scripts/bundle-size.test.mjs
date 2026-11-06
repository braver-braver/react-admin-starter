import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import {
  budgets,
  initialAssets,
  KIB,
  measure,
  overBudget,
} from './check-bundle-size.mjs'

/** A fake `dist` with an entry, a preload, a stylesheet and two lazy chunks. */
function fixture(t, html) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-size-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  mkdirSync(join(dir, 'assets'))
  const files = {
    'assets/index-a.js': 'console.log("entry");'.repeat(50),
    'assets/vendor-b.js': 'export const vendor = 1;'.repeat(80),
    'assets/index-c.css': 'body{color:red}'.repeat(40),
    'assets/page-d.js': 'export const page = 2;'.repeat(200),
    'assets/small-e.js': 'export const e = 3;',
  }
  for (const [file, text] of Object.entries(files))
    writeFileSync(join(dir, file), text)
  writeFileSync(
    join(dir, 'index.html'),
    html ??
      `<!doctype html><html><head>
<link rel="icon" href="/images/favicon.svg" />
<script type="module" crossorigin src="/assets/index-a.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-b.js">
<link rel="stylesheet" crossorigin href="/assets/index-c.css">
<script async src="https://example.test/analytics.js"></script>
</head></html>`
  )
  const gz = (file) => gzipSync(files[file], { level: 9 }).length
  return { dir, gz }
}

test('picks the module entry, module preloads and stylesheets from index.html', () => {
  assert.deepEqual(
    initialAssets(`<script type="module" src="/a.js"></script>
<link rel="modulepreload" href="/b.js"><link rel="stylesheet" href="/c.css">
<link rel="icon" href="/i.svg"><script src="https://cdn.test/x.js"></script>
<script type="module" src="//cdn.test/y.js"></script>
<link rel="stylesheet" href="//cdn.test/z.css">
<link rel="modulepreload" href="data:text/javascript,0">`),
    ['/a.js', '/b.js', '/c.css']
  )
})

test('measures gzip sizes of the initial load, all JS and the largest lazy chunk', (t) => {
  const { dir, gz } = fixture(t)
  assert.deepEqual(measure(dir), {
    initialJs: gz('assets/index-a.js') + gz('assets/vendor-b.js'),
    initialCss: gz('assets/index-c.css'),
    totalJs:
      gz('assets/index-a.js') +
      gz('assets/vendor-b.js') +
      gz('assets/page-d.js') +
      gz('assets/small-e.js'),
    largestLazyJs: gz('assets/page-d.js'),
    largestLazyFile: 'assets/page-d.js',
  })
})

test('reports every budget that is exceeded and nothing when all fit', (t) => {
  const { dir } = fixture(t)
  const measured = measure(dir)
  assert.deepEqual(overBudget(measured), [])
  const failures = overBudget(measured, {
    ...budgets,
    initialJs: measured.initialJs - 1,
    largestLazyJs: measured.largestLazyJs - 1,
  })
  assert.equal(failures.length, 2)
  assert.match(failures[0], /^initial JS: .* > budget /)
  assert.match(failures[1], /^largest lazy JS chunk: .* > budget /)
})

test('fails loudly when index.html points at a missing or outside file', (t) => {
  const missing = fixture(
    t,
    '<script type="module" src="/assets/gone.js"></script>'
  )
  assert.throws(() => measure(missing.dir), /references \/assets\/gone\.js/)
  const outside = fixture(
    t,
    '<script type="module" src="/../secret.js"></script>'
  )
  assert.throws(() => measure(outside.dir), /references \/\.\.\/secret\.js/)
})

test('keeps the budgets at the v1.0 measurement plus headroom', () => {
  assert.deepEqual(budgets, {
    initialJs: 170 * KIB,
    initialCss: 18 * KIB,
    totalJs: 315 * KIB,
    largestLazyJs: 40 * KIB,
  })
})
