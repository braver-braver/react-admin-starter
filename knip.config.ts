import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    // TanStack Router consumes each route file's `Route` export through the
    // generated, git-ignored src/routeTree.gen.ts. Run `pnpm build` (or the
    // dev server) once so that file exists before `pnpm knip`; CI runs knip
    // after the build for that reason.
    'src/routes/**/*.tsx',
    // Started by the demo Playwright config's webServer command.
    'scripts/serve-demo.mjs',
    // Started by the main Playwright config for the production-api project.
    'scripts/serve-stand-in.mjs',
  ],
  // The repo depends on `playwright`, not `@playwright/test`, so knip's
  // Playwright plugin does not enable itself.
  playwright: {
    config: ['playwright*.config.ts'],
    entry: ['e2e/**/*.e2e.ts'],
  },
  ignore: ['src/components/ui/**', 'src/tanstack-table.d.ts'],
  // Used only by shadcn primitives in src/components/ui, which the template
  // keeps as an inventory for adopters even where the demo does not use them.
  ignoreDependencies: [
    '@radix-ui/react-switch',
    '@radix-ui/react-tabs',
    'input-otp',
    'react-day-picker',
  ],
}

export default config
