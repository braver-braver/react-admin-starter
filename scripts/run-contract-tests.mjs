#!/usr/bin/env node
// Runs the contract conformance scenarios against a real back end over HTTP.
//   pnpm test:contract [-- options]      see --help
// Built on node:test and the global fetch (Node 22.18 or later).
import { writeFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseArgs } from 'node:util'

const HELP = `Usage: pnpm test:contract [-- options]

Runs the contract conformance scenarios (src/contract/conformance) against a
running back end, one node:test test per scenario, in order: Tier 1, Tier 2,
then the access checks derived from the operation registry.

Environment:
  CONTRACT_BASE_URL         Origin of the back end, e.g. http://localhost:8000.
                            Without /api/v1: the client adds that prefix.
  CONTRACT_ADMIN_EMAIL      The protected bootstrap admin: every permission,
  CONTRACT_ADMIN_PASSWORD   scope "all", every menu.
  CONTRACT_VIEWER_EMAIL     users:read and permissions:read only, scope "all".
  CONTRACT_VIEWER_PASSWORD
  CONTRACT_GUEST_EMAIL      No permissions; scope "self".
  CONTRACT_GUEST_PASSWORD
  CONTRACT_TIER2=1          Confirms the database is disposable and enables
                            Tier 2. Tier 2 creates its own departments, roles
                            and accounts through the system API, and tries
                            changes that must be refused (such as disabling the
                            bootstrap admin); a non-conformant back end may
                            accept them. Without it Tier 2 is skipped.
  See docs/conformance-fixtures.md for what the back end must contain.

Options:
  --base-url <url>          Overrides CONTRACT_BASE_URL.
  --tier <1|all>            1: Tier 1 and the derived checks only; Tier 2 is
                            then not selected rather than skipped. Default: all.
  --grep <regexp>           Only scenarios whose name matches.
  --json <file>             Also write the results as JSON.
  --timeout <ms>            Per scenario. Default: 60000.
  -h, --help                Show this help.

Exit codes:
  0  every selected scenario ran and passed
  1  at least one scenario failed
  2  invalid configuration (nothing was run)
  3  nothing failed, but Tier 2 was skipped (CONTRACT_TIER2 not set):
     a skipped tier is not a pass`

function fail(message) {
  console.error(`contract: ${message}\nRun with --help for the options.`)
  process.exit(2)
}

let options
try {
  ;({ values: options } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      tier: { type: 'string', default: 'all' },
      grep: { type: 'string' },
      json: { type: 'string' },
      timeout: { type: 'string', default: '60000' },
      help: { type: 'boolean', short: 'h' },
    },
    // `pnpm test:contract -- --tier 1` passes the separator through.
    args: process.argv
      .slice(2)
      .filter((arg, index) => index > 0 || arg !== '--'),
  }))
} catch (error) {
  fail(error.message)
}
if (options.help) {
  console.log(HELP)
  process.exit(0)
}
if (!process.features?.typescript) {
  fail(
    `Node ${process.versions.node} cannot load the TypeScript scenarios. Use Node 22.18 or later.`
  )
}

const env = process.env
const baseUrl = options['base-url'] ?? env.CONTRACT_BASE_URL
const missing = [
  ...(baseUrl ? [] : ['CONTRACT_BASE_URL']),
  ...['ADMIN', 'VIEWER', 'GUEST'].flatMap((who) =>
    ['EMAIL', 'PASSWORD']
      .map((part) => `CONTRACT_${who}_${part}`)
      .filter((name) => !env[name])
  ),
]
if (missing.length) fail(`missing ${missing.join(', ')}.`)
let origin
try {
  origin = new URL(baseUrl)
} catch {
  fail(`CONTRACT_BASE_URL is not a URL: ${baseUrl}`)
}
if (!/^https?:$/.test(origin.protocol))
  fail(`CONTRACT_BASE_URL must be http or https: ${baseUrl}`)
if (/\/api\/v\d+\/?$/.test(origin.pathname))
  fail(
    `CONTRACT_BASE_URL must not end with the API prefix (${origin.pathname}); the client adds /api/v1.`
  )
if (!['1', 'all'].includes(options.tier))
  fail(`--tier must be 1 or all, got ${options.tier}`)
const timeout = Number(options.timeout)
if (!Number.isInteger(timeout) || timeout <= 0)
  fail(`--timeout must be a positive number of milliseconds`)
let grep
try {
  grep = options.grep === undefined ? undefined : new RegExp(options.grep)
} catch (error) {
  fail(`--grep is not a valid regular expression: ${error.message}`)
}

const tier2 =
  options.tier === '1'
    ? { run: false, status: 'not selected (--tier 1)' }
    : env.CONTRACT_TIER2 === '1'
      ? { run: true, status: 'run' }
      : {
          run: false,
          status: 'skipped: set CONTRACT_TIER2=1 on a disposable database',
        }

const fixtures = {
  admin: {
    email: env.CONTRACT_ADMIN_EMAIL,
    password: env.CONTRACT_ADMIN_PASSWORD,
  },
  viewer: {
    email: env.CONTRACT_VIEWER_EMAIL,
    password: env.CONTRACT_VIEWER_PASSWORD,
  },
  guest: {
    email: env.CONTRACT_GUEST_EMAIL,
    password: env.CONTRACT_GUEST_PASSWORD,
  },
}

const { scenarios } = await import('../src/contract/conformance/scenarios.ts')
const { createNodeClient } =
  await import('../src/contract/conformance/node-adapter.ts')

const derived = (scenario) => scenario.name.startsWith('generic: ')
const groups = [
  {
    key: 'tier1',
    label: 'Tier 1',
    list: scenarios.filter((s) => s.tier === 1 && !derived(s)),
  },
  {
    key: 'tier2',
    label: 'Tier 2',
    list: scenarios.filter((s) => s.tier === 2),
  },
  {
    key: 'derived',
    label: 'Derived access checks (Tier 1)',
    list: scenarios.filter(derived),
  },
]
if (options.tier === '1') groups.splice(1, 1)

const selected = (scenario) => !grep || grep.test(scenario.name)
const startedAt = new Date()
/** One entry per selected scenario, in run order. */
const results = []

console.log(
  `contract: ${origin.origin}${origin.pathname.replace(/\/$/, '')} · Tier 2 ${tier2.status}`
)
if (!tier2.run && options.tier !== '1')
  console.log(
    'contract: 跳过 Tier 2 (Tier 2 skipped) — set CONTRACT_TIER2=1 on a disposable database to run it.'
  )

for (const group of groups) {
  const list = group.list.filter(selected)
  if (!list.length) continue
  describe(group.label, { concurrency: 1 }, () => {
    for (const scenario of list) {
      const result = {
        name: scenario.name,
        group: group.key,
        tier: scenario.tier,
        status: 'failed',
        error: `did not finish within ${timeout} ms`,
      }
      results.push(result)
      if (group.key === 'tier2' && !tier2.run) {
        Object.assign(result, { status: 'skipped', error: undefined })
        it(scenario.name, { skip: tier2.status }, () => {})
        continue
      }
      it(scenario.name, { timeout }, async () => {
        const began = performance.now()
        try {
          const client = createNodeClient(baseUrl)
          await client.forget()
          await scenario.run(client, fixtures)
          Object.assign(result, { status: 'passed', error: undefined })
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          throw error
        } finally {
          result.durationMs = Math.round(performance.now() - began)
        }
      })
    }
  })
}

const count = (list) => ({
  passed: list.filter((r) => r.status === 'passed').length,
  failed: list.filter((r) => r.status === 'failed').length,
  skipped: list.filter((r) => r.status === 'skipped').length,
})

// node:test sets the exit code once every test has finished; the summary,
// the JSON report and the final exit code are written after that.
process.on('exit', (code) => {
  const summary = Object.fromEntries(
    groups.map((group) => [
      group.key,
      count(results.filter((r) => r.group === group.key)),
    ])
  )
  const total = count(results)
  console.log('\ncontract summary')
  for (const group of groups) {
    const { passed, failed, skipped } = summary[group.key]
    console.log(
      `  ${group.label.padEnd(32)} ${passed} passed, ${failed} failed, ${skipped} skipped`
    )
  }
  console.log(
    `  ${'Total'.padEnd(32)} ${total.passed} passed, ${total.failed} failed, ${total.skipped} skipped`
  )
  for (const r of results.filter((r) => r.status === 'failed'))
    console.log(`  ✗ ${r.name}\n      ${r.error}`)

  if (options.json) {
    const finishedAt = new Date()
    writeFileSync(
      options.json,
      `${JSON.stringify(
        {
          baseUrl: origin.href,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt - startedAt,
          tier2: tier2.status,
          grep: options.grep ?? null,
          summary: { ...summary, total },
          results,
        },
        null,
        2
      )}\n`
    )
  }

  process.exitCode =
    total.failed || code ? 1 : total.skipped ? 3 : results.length ? 0 : 2
  if (!results.length)
    console.error('contract: no scenario matched; nothing was run.')
})
