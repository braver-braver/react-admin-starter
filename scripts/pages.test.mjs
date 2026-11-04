import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as assembleModule from './assemble-pages.mjs'
import { assemblePages } from './assemble-pages.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'admin-pages-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const siteDir = join(root, 'history'),
    outputDir = join(root, 'output')
  let count = 0
  return {
    siteDir,
    outputDir,
    build(version, commit = 'a'.repeat(40)) {
      const buildDir = join(root, `build-${count++}`)
      mkdirSync(buildDir)
      const base = `/react-admin-starter/${version === 'latest' ? '' : `releases/${version}/`}`
      writeFileSync(
        join(buildDir, 'demo.json'),
        JSON.stringify({ version, commit, base })
      )
      writeFileSync(join(buildDir, 'index.html'), `${version}:${commit}`)
      writeFileSync(join(buildDir, 'mockServiceWorker.js'), 'worker')
      return { buildDir, siteDir, outputDir }
    },
  }
}

test('latest updates preserve two immutable releases and omit git metadata', (t) => {
  const f = fixture(t)
  assemblePages(f.build('latest'))
  mkdirSync(join(f.siteDir, '.git'))
  writeFileSync(join(f.siteDir, '.git', 'config'), 'private deployment config')
  assemblePages(f.build('v0.1.0'))
  assemblePages(f.build('v0.2.0', 'b'.repeat(40)))
  assemblePages(f.build('latest', 'c'.repeat(40)))
  assert.match(
    readFileSync(join(f.outputDir, 'index.html'), 'utf8'),
    /latest:ccc/
  )
  assert.match(
    readFileSync(join(f.outputDir, 'releases/v0.1.0/index.html'), 'utf8'),
    /v0.1.0:aaa/
  )
  assert.match(
    readFileSync(join(f.outputDir, 'releases/v0.2.0/index.html'), 'utf8'),
    /v0.2.0:bbb/
  )
  assert.equal(
    JSON.parse(readFileSync(join(f.outputDir, 'versions.json'))).length,
    2
  )
  assert.match(
    readFileSync(join(f.outputDir, 'versions.html'), 'utf8'),
    /releases\/v0.1.0\//
  )
  assert.equal(existsSync(join(f.outputDir, '.git')), false)
})
test('release retries preserve bytes and reject changed provenance', (t) => {
  const f = fixture(t)
  assemblePages(f.build('v0.1.0'))
  const retry = f.build('v0.1.0')
  writeFileSync(join(retry.buildDir, 'index.html'), 'different build bytes')
  assemblePages(retry)
  assert.match(
    readFileSync(join(f.outputDir, 'releases/v0.1.0/index.html'), 'utf8'),
    /v0.1.0:aaa/
  )
  assert.throws(
    () => assemblePages(f.build('v0.1.0', 'b'.repeat(40))),
    /immutable release/
  )
})
test('refuses symlinked root directories before updating snapshots', (t) => {
  const f = fixture(t)
  const build = f.build('latest')
  mkdirSync(f.siteDir)
  const linkedSite = join(f.siteDir, '..', 'linked-site')
  symlinkSync(f.siteDir, linkedSite, 'dir')
  assert.throws(
    () => assemblePages({ ...build, siteDir: linkedSite }),
    /Symlink in Pages root/
  )
})

test('invalid tags, paths, overlapping output and symlinks fail before publishing', (t) => {
  const f = fixture(t)
  assert.throws(
    () => assemblePages(f.build('../escape')),
    /Invalid demo version/
  )
  const invalidBase = f.build('v0.1.0')
  writeFileSync(
    join(invalidBase.buildDir, 'demo.json'),
    JSON.stringify({
      version: 'v0.1.0',
      commit: 'a'.repeat(40),
      base: '/wrong/',
    })
  )
  assert.throws(() => assemblePages(invalidBase), /base does not match/)
  const overlap = f.build('latest')
  assert.throws(
    () => assemblePages({ ...overlap, outputDir: overlap.siteDir }),
    /separate/
  )
  const linked = f.build('latest')
  symlinkSync('/etc/passwd', join(linked.buildDir, 'secret'))
  assert.throws(() => assemblePages(linked), /Symlink/)
})

test('every name a workflow imports from a script is exported', async () => {
  const workflows = ['ci.yml', 'pages.yml'].map((name) =>
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      'utf8'
    )
  )
  const imports = workflows.flatMap((text) =>
    [
      ...text.matchAll(
        /import \{([^}]+)\} from '\.\/scripts\/assemble-pages\.mjs'/g
      ),
    ].flatMap((match) => match[1].split(',').map((name) => name.trim()))
  )
  assert.ok(imports.includes('releasePattern'))
  for (const name of imports) {
    assert.ok(name in assembleModule, `assemble-pages.mjs must export ${name}`)
  }
})

test('release deploys use a build version that main has not deployed', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/pages.yml', import.meta.url),
    'utf8'
  )
  const step = (name) => {
    const start = workflow.indexOf(`      - name: ${name}\n`)
    assert.ok(start >= 0, `pages.yml must have the step "${name}"`)
    const end = workflow.indexOf('\n      - name: ', start + 1)
    return workflow.slice(start, end < 0 ? undefined : end)
  }
  // actions/deploy-pages always deploys with GITHUB_SHA as the build version,
  // which main has already used for the tagged commit (#91).
  assert.match(
    step('Deploy GitHub Pages'),
    /if: github\.event_name != 'release'\n\s+uses: actions\/deploy-pages@/
  )
  const release = step('Deploy GitHub Pages for the release')
  assert.match(release, /if: github\.event_name == 'release'/)
  assert.match(
    release,
    /BUILD_VERSION: \$\{\{ github\.sha \}\}-\$\{\{ env\.DEMO_VERSION \}\}-\$\{\{ github\.run_attempt \}\}/
  )
  assert.match(
    release,
    /ARTIFACT_ID: \$\{\{ steps\.upload\.outputs\.artifact_id \}\}/
  )
  assert.match(release, /core\.setOutput\('page_url'/)
  for (const use of ['url:', 'LIVE_DEMO_SITE_URL:', 'PAGE_URL:']) {
    assert.match(
      workflow,
      new RegExp(
        `${use} \\$\\{\\{ steps\\.deployment\\.outputs\\.page_url \\|\\| steps\\.release-deployment\\.outputs\\.page_url \\}\\}`
      ),
      `${use} must fall back to the release deployment URL`
    )
  }
})
