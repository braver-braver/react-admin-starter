#!/usr/bin/env node
// Checks that a release tag matches the code it points to, before anything is
// published (docs/releasing.md):
//   pnpm release:check v1.0.0-rc.1 [--dir app] [--repo .] [--commit <sha>] [--main origin/main] [--skip-main]
// The Pages workflow runs it before building a Release, so a wrong tag never
// reaches the immutable pages-snapshots branch.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { releasePattern } from './assemble-pages.mjs'

/** Everything from this heading on is upstream history, not our releases. */
const UPSTREAM_HEADING = /^## Historical upstream changelog\b/m

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whether the project part of the CHANGELOG has a `## v<version>` heading. */
export function hasChangelogSection(changelog, version) {
  const upstream = changelog.search(UPSTREAM_HEADING)
  const own = upstream === -1 ? changelog : changelog.slice(0, upstream)
  return new RegExp(`^## v${escape(version)}(?:\\s|$)`, 'm').test(own)
}

/**
 * The problems of a release, empty when it may be published. `onMain` is
 * `undefined` when the ancestry check was skipped.
 */
export function releaseProblems({ tag, version, changelog, onMain }) {
  const problems = []
  if (!releasePattern.test(tag))
    problems.push(
      `tag ${tag} is not vMAJOR.MINOR.PATCH with an optional prerelease suffix`
    )
  if (tag !== `v${version}`)
    problems.push(`tag ${tag} does not match package.json version ${version}`)
  if (!hasChangelogSection(changelog, version))
    problems.push(
      `CHANGELOG.md has no "## v${version}" section above the upstream history`
    )
  if (onMain === false) problems.push(`the tagged commit is not on main`)
  return problems
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/**
 * Whether `commit` is `main` or one of its ancestors, in `repo` (a clone with
 * the full history of main). A commit that clone does not have is not on main.
 */
function isOnMain(repo, commit, main) {
  let resolved
  try {
    resolved = git(repo, [
      'rev-parse',
      '--verify',
      '--quiet',
      `${commit}^{commit}`,
    ])
  } catch {
    if (/^[0-9a-f]{40}$/i.test(commit)) return { onMain: false, commit }
    throw new Error(`cannot resolve ${commit} in ${repo}`)
  }
  try {
    execFileSync(
      'git',
      ['-C', repo, 'merge-base', '--is-ancestor', resolved, main],
      {
        stdio: 'ignore',
      }
    )
    return { onMain: true, commit: resolved }
  } catch (error) {
    if (error.status === 1) return { onMain: false, commit: resolved }
    throw new Error(
      `cannot compare ${resolved} with ${main}; fetch the full history of main first`
    )
  }
}

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: '.' },
      repo: { type: 'string' },
      commit: { type: 'string', default: 'HEAD' },
      main: { type: 'string', default: 'origin/main' },
      'skip-main': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const tag = positionals.filter((arg) => arg !== '--')[0]
  if (values.help || !tag) {
    console.log(`Usage: pnpm release:check <tag> [--dir <dir>] [--repo <dir>] [--commit <sha>] [--main <ref>] [--skip-main]

Checks a release tag before it is published:
  1. the tag is vMAJOR.MINOR.PATCH with an optional prerelease suffix
  2. the tag is "v" + the version in <dir>/package.json
  3. <dir>/CHANGELOG.md has a "## v<version>" section above the upstream history
  4. <commit> (default HEAD) is on <main> (default origin/main), checked in
     <repo> (default <dir>), which needs the full history of main
--skip-main skips check 4, for a release PR whose commit is not on main yet.`)
    return values.help ? 0 : 2
  }
  const dir = resolve(values.dir)
  const { version } = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  )
  const changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')
  const ancestry = values['skip-main']
    ? undefined
    : isOnMain(resolve(values.repo ?? values.dir), values.commit, values.main)
  const problems = releaseProblems({
    tag,
    version,
    changelog,
    onMain: ancestry?.onMain,
  })
  if (problems.length) {
    console.error(`release:check ${tag}: FAILED`)
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    return 1
  }
  console.log(
    `release:check ${tag}: ok (package.json ${version}, CHANGELOG section found, ${
      ancestry
        ? `${ancestry.commit.slice(0, 7)} is on ${values.main}`
        : 'main not checked (--skip-main)'
    })`
  )
  return 0
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`release:check: ${error.message}`)
    process.exitCode = 2
  }
}
