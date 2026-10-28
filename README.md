# React Admin Starter

A lightweight, Chinese-first, reusable React admin application based on [shadcn-admin](https://github.com/satnaing/shadcn-admin).

> **Status:** v0.2 in progress. The shell is Chinese-first, with a development-only MSW mock API powering login, sessions and an RBAC reference. **Mocks never ship in the production bundle; real authentication and authorization belong to your backend.**

## Tech stack

React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Router, TanStack Query, TanStack Table, React Hook Form, Zod, MSW and pnpm.

## Get started

Requires Node.js 22 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The dev server starts the MSW mock API automatically. Sign in with one of the demo accounts (also shown on the sign-in page):

| 邮箱                   | 口令             | 角色     | 权限                   |
| ---------------------- | ---------------- | -------- | ---------------------- |
| `admin@example.com`    | `Admin123456`    | 管理员   | 全部权限（含审计只读） |
| `operator@example.com` | `Operator123456` | 运营人员 | 仪表盘 + 用户管理      |
| `viewer@example.com`   | `Viewer123456`   | 只读访客 | 仪表盘 + 用户只读      |

Demo credentials are public, development-only fixtures — rotate them out when wiring a real backend.

Environment variables (see `.env.example`):

- `VITE_API_BASE_URL` — REST base URL, defaults to `/api`.
- `VITE_ENABLE_MSW` — set to `false` to bypass mocks in development and talk to a real service.

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
- [x] v0.2: Development-only MSW APIs, authentication and RBAC reference implementation (#3)
- [ ] v0.2: Reusable server-side CRUD, uploads and audit-log examples (#4)
- [ ] v1.0: Stable API contract, documentation and template-quality release

See [engineering guidelines](AGENTS.md), [architecture](docs/architecture.md), [branding guide](docs/branding.md) and [upstream provenance](docs/upstream.md). Work is tracked in [GitHub Issues](https://github.com/braver-braver/react-admin-starter/issues).

## Design principles

- Backend-agnostic and Mock-first
- Feature-oriented structure, minimal abstractions
- Demo credentials and tokens must never become production defaults
- Server authorization is mandatory; client permission checks only improve UX
- No `face_system` or GoFrame-specific logic in this repository

## Attribution and license

Adapted from [Sat Naing's shadcn-admin](https://github.com/satnaing/shadcn-admin) at commit `e16c87f213a5ba5e45964e9b67c792105ec74d26`.

Licensed under the MIT License. See [LICENSE](LICENSE) for the original copyright notice and terms.
