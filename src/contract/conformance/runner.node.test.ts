// Runs under `node --test` (Node ≥ 22.18), not Vitest: `pnpm test:conformance`.
// Spawns scripts/run-contract-tests.mjs (`pnpm test:contract`) as a back-end
// project would, against the minimal stand-in.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { standInFixtures, startStandIn } from './stand-in.node.ts'

const script = fileURLToPath(
  new URL('../../../scripts/run-contract-tests.mjs', import.meta.url)
)
/** The auth scenarios: all the minimal stand-in can serve. */
const AUTH = '^(login|getSession|logout): '
const PROTECTED = '^AGENTS\\.md: keep bootstrap'

type Run = { code: number; stdout: string; stderr: string }

function fixtureEnv(baseUrl: string) {
  const env: Record<string, string> = { CONTRACT_BASE_URL: baseUrl }
  for (const [who, account] of Object.entries(standInFixtures)) {
    env[`CONTRACT_${who.toUpperCase()}_EMAIL`] = account.email
    env[`CONTRACT_${who.toUpperCase()}_PASSWORD`] = account.password
  }
  return env
}

function runner(args: string[], extra: Record<string, string> = {}) {
  // A child of `node --test` would otherwise report to this test runner.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => name !== 'NODE_TEST_CONTEXT' && !name.startsWith('CONTRACT_')
    )
  )
  return new Promise<Run>((resolve) => {
    execFile(
      process.execPath,
      [script, ...args],
      { env: { ...env, ...extra }, timeout: 60_000 },
      (error, stdout, stderr) =>
        resolve({
          code:
            error && typeof error.code === 'number'
              ? error.code
              : error
                ? -1
                : 0,
          stdout,
          stderr,
        })
    )
  })
}

describe('pnpm test:contract (scripts/run-contract-tests.mjs)', () => {
  type StandIn = Awaited<ReturnType<typeof startStandIn>>
  let correct: StandIn
  let broken: StandIn
  let slow: StandIn
  let dir: string
  before(async () => {
    correct = await startStandIn('correct')
    broken = await startStandIn('session-ignores-cookie')
    slow = await startStandIn('slow-session')
    dir = mkdtempSync(join(tmpdir(), 'contract-runner-'))
  })
  after(() => {
    correct.server.close()
    broken.server.close()
    slow.server.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('documents every option, variable and exit code in --help', async () => {
    const { code, stdout } = await runner(['--help'])
    assert.equal(code, 0)
    for (const text of [
      'CONTRACT_BASE_URL',
      'CONTRACT_ADMIN_EMAIL',
      'CONTRACT_ADMIN_PASSWORD',
      'CONTRACT_VIEWER_EMAIL',
      'CONTRACT_VIEWER_PASSWORD',
      'CONTRACT_GUEST_EMAIL',
      'CONTRACT_GUEST_PASSWORD',
      'CONTRACT_TIER2',
      '--base-url',
      '--tier',
      '--grep',
      '--json',
      '--timeout',
      'Exit codes',
    ])
      assert.ok(stdout.includes(text), text)
  })

  it('exits 2 and runs nothing when the configuration is incomplete or wrong', async () => {
    const empty = await runner([])
    assert.equal(empty.code, 2)
    assert.match(
      empty.stderr,
      /missing CONTRACT_BASE_URL, CONTRACT_ADMIN_EMAIL/
    )
    const prefixed = await runner([], fixtureEnv(`${correct.url}/api/v1`))
    assert.equal(prefixed.code, 2)
    assert.match(prefixed.stderr, /must not end with the API prefix/)
    const tier = await runner(['--tier', '2'], fixtureEnv(correct.url))
    assert.equal(tier.code, 2)
    const none = await runner(
      ['--grep', '^no such scenario$', '--tier', '1'],
      fixtureEnv(correct.url)
    )
    assert.equal(none.code, 2)
    assert.match(none.stderr, /no scenario matched/)
  })

  it('exits 0 when every selected scenario passes, and writes the JSON report', async () => {
    const report = join(dir, 'pass.json')
    const { code, stdout } = await runner(
      ['--', '--tier', '1', '--grep', AUTH, '--json', report],
      fixtureEnv(correct.url)
    )
    assert.equal(code, 0, stdout)
    assert.match(stdout, /Tier 2 not selected/)
    assert.match(stdout, /Tier 1\s+4 passed, 0 failed, 0 skipped/)
    const json = JSON.parse(readFileSync(report, 'utf8'))
    assert.equal(json.tier2, 'not selected (--tier 1)')
    assert.deepEqual(json.summary.total, { passed: 4, failed: 0, skipped: 0 })
    assert.equal(json.results.length, 4)
    for (const result of json.results) {
      assert.equal(result.status, 'passed')
      assert.equal(result.group, 'tier1')
      assert.equal(typeof result.durationMs, 'number')
    }
  })

  it('exits 3, not 0, when Tier 2 is skipped; says so on the terminal and in the report', async () => {
    const report = join(dir, 'skip.json')
    const { code, stdout } = await runner(
      ['--grep', `${AUTH}|${PROTECTED}`, '--json', report],
      fixtureEnv(correct.url)
    )
    assert.equal(code, 3, stdout)
    assert.match(stdout, /跳过 Tier 2/)
    assert.match(stdout, /Tier 2\s+0 passed, 0 failed, 1 skipped/)
    const json = JSON.parse(readFileSync(report, 'utf8'))
    assert.match(json.tier2, /^skipped/)
    assert.deepEqual(json.summary.tier2, { passed: 0, failed: 0, skipped: 1 })
  })

  it('runs Tier 2 once CONTRACT_TIER2=1 confirms a disposable database', async () => {
    // The minimal stand-in has no system API, so the Tier 2 scenario fails.
    const { code, stdout } = await runner(['--grep', PROTECTED], {
      ...fixtureEnv(correct.url),
      CONTRACT_TIER2: '1',
    })
    assert.equal(code, 1, stdout)
    assert.match(stdout, /Tier 2\s+0 passed, 1 failed, 0 skipped/)
    assert.match(stdout, /✗ AGENTS\.md: keep bootstrap/)
  })

  it('exits 1 and names the failing scenario and its reason when a back end is broken', async () => {
    const report = join(dir, 'fail.json')
    const { code, stdout } = await runner(
      ['--tier', '1', '--grep', AUTH, '--json', report],
      fixtureEnv(broken.url)
    )
    assert.equal(code, 1, stdout)
    assert.match(
      stdout,
      /✗ login: valid credentials[^\n]*\n\s+getSession .* 401/
    )
    const json = JSON.parse(readFileSync(report, 'utf8'))
    assert.ok(json.summary.total.failed >= 1)
    assert.ok(
      json.results.some(
        (r: { status: string; error?: string }) =>
          r.status === 'failed' && /getSession/.test(r.error ?? '')
      )
    )
  })

  it('aborts a timed-out scenario before the next one starts, and keeps it failed', async () => {
    const report = join(dir, 'timeout.json')
    // getSession takes 1 s on this stand-in; only the first scenario signs in
    // and so waits for it.
    const { code, stdout } = await runner(
      [
        '--tier',
        '1',
        '--grep',
        '^(login|getSession): ',
        '--timeout',
        '300',
        '--json',
        report,
      ],
      fixtureEnv(slow.url)
    )
    assert.equal(code, 1, stdout)
    const json = JSON.parse(readFileSync(report, 'utf8'))
    assert.deepEqual(
      json.results.map((r: { name: string; status: string }) => [
        r.name.split(':')[0],
        r.status,
      ]),
      [
        ['login', 'failed'],
        ['getSession', 'passed'],
        ['login', 'passed'],
      ]
    )
    assert.match(json.results[0].error, /did not finish within 300 ms/)
    // The client cancelled the slow request, and nothing else reached the
    // server while it was pending.
    assert.equal(slow.stats.abandoned, 1)
    assert.equal(slow.stats.overlapped, 0)
  })
})
