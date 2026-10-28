/// <reference types="vite/client" />

// Only the dedicated demo build may ship browser mock authentication.
declare const __DEMO_BUILD__: boolean
declare const __DEMO_METADATA__: {
  version: string
  commit: string
  base: string
} | null
