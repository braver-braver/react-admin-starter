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
import { assemblePages, compareVersions } from './assemble-pages.mjs'

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

test('Pages deploys use the pages-snapshots commit as the build version', () => {
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
  // Pages resolves the build version as a commit of the repository and keeps
  // the existing deployment for a repeated one. actions/deploy-pages always
  // sends GITHUB_SHA, which main has already deployed when a Release tags the
  // same commit (#91); a composite string such as <sha>-<tag> is rejected.
  assert.doesNotMatch(workflow, /actions\/deploy-pages@/)
  const snapshot = step('Persist verified site snapshots')
  assert.match(snapshot, /id: snapshot\n/)
  assert.match(
    snapshot,
    /echo "commit=\$\(git -C \.pages-site rev-parse HEAD\)" >> "\$GITHUB_OUTPUT"/
  )
  const deploy = step('Deploy GitHub Pages')
  assert.match(deploy, /id: deployment\n/)
  assert.doesNotMatch(deploy, /\bif:/)
  assert.match(
    deploy,
    /BUILD_VERSION: \$\{\{ steps\.snapshot\.outputs\.commit \}\}/
  )
  assert.match(
    deploy,
    /ARTIFACT_ID: \$\{\{ steps\.upload\.outputs\.artifact_id \}\}/
  )
  assert.match(deploy, /pages_build_version: process\.env\.BUILD_VERSION/)
  assert.match(deploy, /core\.setOutput\('page_url'/)
  assert.ok(
    workflow.indexOf('      - name: Persist verified site snapshots') <
      workflow.indexOf('      - name: Deploy GitHub Pages'),
    'the snapshot must be pushed before it is used as the build version'
  )
})

test('the Pages deploy step retries transient status errors and cancels when it gives up', async (t) => {
  const workflow = readFileSync(
    new URL('../.github/workflows/pages.yml', import.meta.url),
    'utf8'
  )
  const marker = '          script: |\n'
  const start =
    workflow.indexOf(
      marker,
      workflow.indexOf('      - name: Deploy GitHub Pages\n')
    ) + marker.length
  const body = workflow
    .slice(start, workflow.indexOf('\n      - name: ', start))
    .split('\n')
    .map((line) => line.replace(/^ {12}/, ''))
    .join('\n')
  const AsyncFunction = (async () => {}).constructor
  const deploy = new AsyncFunction('github', 'context', 'core', body)
  t.mock.method(globalThis, 'setTimeout', (callback) => callback())
  t.mock.method(Date, 'now', () => 0)
  process.env.ARTIFACT_ID = '1'
  process.env.BUILD_VERSION = 'a'.repeat(40)

  const run = async (statuses) => {
    const routes = []
    const outputs = {}
    const github = {
      request: async (route) => {
        routes.push(route)
        if (route.endsWith('/pages/deployments'))
          return {
            data: {
              status_url: 'https://api.github.test/pages/deployments/7',
              page_url: 'https://pages.test/',
            },
          }
        if (route.endsWith('/cancel')) return { data: {} }
        const next = statuses.shift()
        if (next instanceof Error) throw next
        return { data: { status: next } }
      },
    }
    const core = {
      info() {},
      warning() {},
      getIDToken: async () => 'oidc',
      setOutput: (name, value) => (outputs[name] = value),
    }
    let error
    try {
      await deploy(github, { repo: { owner: 'o', repo: 'r' } }, core)
    } catch (caught) {
      error = caught
    }
    return {
      error,
      outputs,
      cancelled: routes.some((route) => route.endsWith('/cancel')),
    }
  }
  const failure = (status) =>
    Object.assign(new Error('request failed'), { status })

  const recovered = await run([
    failure(404),
    failure(502),
    'not_found',
    'deployment_in_progress',
    'succeed',
  ])
  assert.equal(recovered.error, undefined)
  assert.equal(recovered.outputs.page_url, 'https://pages.test/')

  const exhausted = await run(Array.from({ length: 10 }, () => failure(500)))
  assert.match(exhausted.error.message, /failed 10 times in a row/)
  assert.ok(exhausted.cancelled)

  const final = await run(['deployment_queued', 'deployment_failed'])
  assert.match(final.error.message, /ended with deployment_failed/)
  assert.ok(!final.cancelled)
})

test('orders versions by SemVer precedence, as in the semver.org example (#107)', () => {
  const ascending = [
    'v1.0.0-alpha',
    'v1.0.0-alpha.1',
    'v1.0.0-alpha.beta',
    'v1.0.0-beta',
    'v1.0.0-beta.2',
    'v1.0.0-beta.11',
    'v1.0.0-rc.1',
    'v1.0.0-rc.9',
    'v1.0.0-rc.10',
    'v1.0.0',
    'v1.9.0',
    'v1.10.0',
    'v2.0.0-rc.1',
  ]
  assert.deepEqual([...ascending].reverse().sort(compareVersions), ascending)
  assert.equal(compareVersions('v1.0.0', 'v1.0.0'), 0)
})

test('lists a stable release above its release candidates in the index (#107)', (t) => {
  const f = fixture(t)
  assemblePages(f.build('latest'))
  for (const [version, commit] of [
    ['v1.0.0-rc.1', 'a'],
    ['v1.0.0-rc.3', 'b'],
    ['v1.0.0', 'c'],
    ['v1.0.0-rc.2', 'd'],
  ])
    assemblePages(f.build(version, commit.repeat(40)))
  const expected = ['v1.0.0', 'v1.0.0-rc.3', 'v1.0.0-rc.2', 'v1.0.0-rc.1']
  assert.deepEqual(
    JSON.parse(readFileSync(join(f.outputDir, 'versions.json'), 'utf8')).map(
      (entry) => entry.version
    ),
    expected
  )
  const html = readFileSync(join(f.outputDir, 'versions.html'), 'utf8')
  const positions = expected.map((version) => html.indexOf(`>${version}<`))
  assert.ok(positions.every((at) => at >= 0))
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions
  )
})
