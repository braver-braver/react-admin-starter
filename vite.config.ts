/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const demo = mode === 'demo' && command === 'build'
  const base = demo ? (process.env.DEMO_BASE_PATH ?? '/') : '/'
  if (
    !base.startsWith('/') ||
    !base.endsWith('/') ||
    !/^\/[a-zA-Z0-9._/-]*$/.test(base) ||
    base.includes('..') ||
    base.includes('//')
  ) {
    throw new Error(
      'DEMO_BASE_PATH must be an absolute directory path with a trailing slash'
    )
  }
  const metadata = demo
    ? {
        version: process.env.DEMO_VERSION ?? 'local',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim(),
        base,
      }
    : null
  const worker = () => {
    const require = createRequire(import.meta.url)
    return readFileSync(
      path.join(
        path.dirname(require.resolve('msw/package.json')),
        'lib/mockServiceWorker.js'
      )
    )
  }
  return {
    base,
    build: { outDir: demo ? 'dist-demo' : 'dist' },
    define: {
      __DEMO_BUILD__: JSON.stringify(demo),
      __DEMO_METADATA__: JSON.stringify(metadata),
    },
    plugins: [
      ...(demo
        ? [
            {
              name: 'static-demo-artifacts',
              generateBundle() {
                this.emitFile({
                  type: 'asset',
                  fileName: 'mockServiceWorker.js',
                  source: worker(),
                })
                this.emitFile({
                  type: 'asset',
                  fileName: 'demo.json',
                  source: JSON.stringify(metadata, null, 2) + '\n',
                })
              },
            } satisfies import('vite').Plugin,
          ]
        : []),
      {
        name: 'development-msw-worker',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use(
            '/mockServiceWorker.js',
            (_request, response) => {
              response.setHeader('Content-Type', 'text/javascript')
              response.setHeader('Cache-Control', 'no-store')
              response.end(worker())
            }
          )
        },
      },
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      silent: 'passed-only',
      unstubEnvs: true,
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
        exclude: [
          'src/components/ui/**',
          'src/assets/**',
          'src/tanstack-table.d.ts',
          'src/routeTree.gen.ts',
          'src/test-utils/**',
          'src/routes/**',
        ],
      },
    },
  }
})
