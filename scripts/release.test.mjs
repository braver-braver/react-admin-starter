import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { hasChangelogSection, releaseProblems } from './check-release.mjs'

const script = fileURLToPath(new URL('./check-release.mjs', import.meta.url))

/** A CHANGELOG shaped like this repository's: our releases, then upstream. */
const changelog = (...own) => `# Changelog

## Unreleased — React Admin Starter

- Something new.

${own.map((version) => `## v${version} (2026-11-02)\n\n- Released.\n`).join('\n')}
## Historical upstream changelog — shadcn-admin only

## v1.0.0 (2024-12-09)

- Upstream release, not ours.
`

const ok = {
  tag: 'v1.0.0-rc.1',
  version: '1.0.0-rc.1',
  changelog: changelog('1.0.0-rc.1'),
  onMain: true,
}

describe('releaseProblems', () => {
  it('passes a release whose tag, version, CHANGELOG and commit agree', () => {
    assert.deepEqual(releaseProblems(ok), [])
  })

  it('rejects a malformed tag', () => {
    for (const tag of ['1.0.0', 'v1.0', 'v1.0.0_rc1', 'release-1.0.0']) {
      const problems = releaseProblems({ ...ok, tag })
      assert.match(problems[0], /is not vMAJOR\.MINOR\.PATCH/, tag)
    }
  })

  it('rejects a tag that differs from the package.json version', () => {
    assert.deepEqual(releaseProblems({ ...ok, tag: 'v1.0.0-rc.2' }), [
      'tag v1.0.0-rc.2 does not match package.json version 1.0.0-rc.1',
    ])
  })

  it('rejects a version without its own CHANGELOG section', () => {
    assert.deepEqual(releaseProblems({ ...ok, changelog: changelog() }), [
      'CHANGELOG.md has no "## v1.0.0-rc.1" section above the upstream history',
    ])
  })

  it('does not take an upstream heading of the same version as our section', () => {
    assert.equal(hasChangelogSection(changelog(), '1.0.0'), false)
    assert.equal(hasChangelogSection(changelog('1.0.0'), '1.0.0'), true)
    // A prefix is not a match: v1.0.0 is not v1.0.0-rc.1.
    assert.equal(hasChangelogSection(changelog('1.0.0-rc.1'), '1.0.0'), false)
  })

  it('rejects a commit that is not on main, and skips the check when asked', () => {
    assert.deepEqual(releaseProblems({ ...ok, onMain: false }), [
      'the tagged commit is not on main',
    ])
    assert.deepEqual(releaseProblems({ ...ok, onMain: undefined }), [])
  })
})

describe('pnpm release:check (CLI in a temporary repository)', () => {
  const git = (dir, ...args) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()

  /** main with a release commit, plus a side branch with one more commit. */
  function repository(
    t,
    { version = '1.0.0-rc.1', sections = [version] } = {}
  ) {
    const dir = mkdtempSync(join(tmpdir(), 'release-check-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'config', 'user.email', 'test@example.test')
    git(dir, 'config', 'user.name', 'Test')
    // An older commit on main, before the version bump.
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ version: '0.9.0' })
    )
    writeFileSync(join(dir, 'CHANGELOG.md'), changelog())
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'before the release')
    const older = git(dir, 'rev-parse', 'HEAD')
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version }))
    writeFileSync(join(dir, 'CHANGELOG.md'), changelog(...sections))
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'release')
    const release = git(dir, 'rev-parse', 'HEAD')
    git(dir, 'checkout', '-q', '-b', 'side')
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'not on main')
    const side = git(dir, 'rev-parse', 'HEAD')
    git(dir, 'checkout', '-q', 'main')
    return { dir, older, release, side }
  }

  const run = (dir, ...args) =>
    spawnSync(
      process.execPath,
      [script, ...args, '--repo', dir, '--dir', dir, '--main', 'main'],
      {
        encoding: 'utf8',
      }
    )

  it('exits 0 for a release commit on main', (t) => {
    const { dir, release } = repository(t)
    const result = run(dir, 'v1.0.0-rc.1', '--commit', release)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /release:check v1\.0\.0-rc\.1: ok/)
  })

  it('checks the files of the selected commit, not the working tree', (t) => {
    // The working tree (main) has the right version, but the SHA given is an
    // older commit on main whose package.json and CHANGELOG were never bumped.
    const { dir, older } = repository(t)
    const result = run(dir, 'v1.0.0-rc.1', '--commit', older)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /does not match package\.json version 0\.9\.0/)
    assert.match(result.stderr, /has no "## v0\.9\.0" section/)
  })

  it('exits 1 and lists every problem', (t) => {
    const { dir, side } = repository(t, { version: '1.0.0', sections: [] })
    const result = run(dir, 'v1.0.0-rc.1', '--commit', side)
    assert.equal(result.status, 1)
    for (const text of [
      'does not match package.json version 1.0.0',
      'has no "## v1.0.0" section',
      'the tagged commit is not on main',
    ])
      assert.ok(result.stderr.includes(text), text)
  })

  it('treats a commit the full clone does not have as not on main', (t) => {
    const { dir } = repository(t)
    const result = run(dir, 'v1.0.0-rc.1', '--commit', 'f'.repeat(40))
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not on main/)
  })

  it('skips the main check with --skip-main and says so', (t) => {
    const { dir, side } = repository(t)
    const result = run(dir, 'v1.0.0-rc.1', '--commit', side, '--skip-main')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /main not checked \(--skip-main\)/)
  })

  it('honours options after the `--` that pnpm passes through', (t) => {
    const { dir, side } = repository(t)
    // As `pnpm release:check -- v1.0.0-rc.1 --commit <side>` runs it.
    const result = spawnSync(
      process.execPath,
      [
        script,
        '--',
        'v1.0.0-rc.1',
        '--commit',
        side,
        '--repo',
        dir,
        '--main',
        'main',
      ],
      { encoding: 'utf8' }
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /the tagged commit is not on main/)
  })

  it('exits 2 with usage when no tag is given', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    assert.equal(result.status, 2)
    assert.match(result.stdout, /Usage: pnpm release:check <tag>/)
  })
})
