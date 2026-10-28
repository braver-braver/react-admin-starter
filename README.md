# React Admin Starter

A lightweight, Chinese-first, reusable React admin application based on [shadcn-admin](https://github.com/satnaing/shadcn-admin).

> **Status:** v0.2. The shell is Chinese-first. Development builds ship MSW-backed cookie sessions, RBAC, server-driven user CRUD, image upload and audit-log examples; production requires a real same-origin auth API with server-side authorization.\*\*

## Tech stack

React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Router, TanStack Query, TanStack Table, React Hook Form, Zod and pnpm.

## Get started

Requires Node.js 22 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Available checks:

```bash
pnpm lint
pnpm format:check
pnpm test:browser:install
pnpm test
pnpm build
```

The tests use Playwright/Chromium. CI installs the required browser automatically.

## Roadmap

- [x] Import the pinned upstream source, assets and license
- [x] v0.1: Remove unrelated demo routes, localize navigation and expose app branding
- [x] v0.2: Development-only MSW APIs, authentication and RBAC reference implementation
- [x] v0.2: Reusable server-side CRUD, uploads and audit-log examples
- [ ] v1.0: Stable API contract, documentation and template-quality release

See [engineering guidelines](AGENTS.md), [architecture](docs/architecture.md), [branding guide](docs/branding.md) and [upstream provenance](docs/upstream.md). Work is tracked in [GitHub Issues](https://github.com/braver-braver/react-admin-starter/issues).

See [API and authentication guide](docs/auth-and-api.md) for demo accounts, the API contract and production integration requirements.

## Design principles

- Backend-agnostic and Mock-first
- Feature-oriented structure, minimal abstractions
- Demo credentials and tokens must never become production defaults
- Server authorization is mandatory; client permission checks only improve UX
- No `face_system` or GoFrame-specific logic in this repository

## Attribution and license

Adapted from [Sat Naing's shadcn-admin](https://github.com/satnaing/shadcn-admin) at commit `e16c87f213a5ba5e45964e9b67c792105ec74d26`.

Licensed under the MIT License. See [LICENSE](LICENSE) for the original copyright notice and terms.
