#!/usr/bin/env node
// Serves the conformance stand-in back end (a test double, not a reference
// implementation) for the production E2E: `node scripts/serve-stand-in.mjs 5194`.
const port = Number(process.argv[2] ?? 5194)
const { startStandIn } =
  await import('../src/contract/conformance/stand-in.node.ts')
const { url } = await startStandIn('correct', { port })
console.log(`stand-in back end listening on ${url}`)
