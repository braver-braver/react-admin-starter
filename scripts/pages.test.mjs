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

