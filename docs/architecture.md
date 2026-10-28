# Architecture

## Objective
A reusable React Admin Starter, **not** a rewrite of face_system V1.

## Runtime architecture
React application → feature API functions → shared HTTP client → MSW development handlers or a configurable REST service.

No backend runtime is required for local demo mode. GoFrame, Gin and other backends are future consumers of the API contract, not dependencies of the starter.

## v0.2 API and auth layer
- **HTTP client** (`src/lib/api-client.ts`): axios instance with `VITE_API_BASE_URL` (default `/api`), automatic bearer-token injection and backend-agnostic error helpers (`getErrorStatus`, `getApiErrorMessage`). Error bodies are read as problem-json-ish `{ title, detail, message }`; no GoFrame semantics.
- **Typed contracts** (`src/features/auth/schemas.ts`): zod schemas for `SessionUser`, sign-in payload/response. Every API response is parsed before reaching the UI.
- **Auth API** (`src/features/auth/api.ts`): `POST /auth/sign-in`, `GET /auth/session`, `POST /auth/sign-out`.
- **Session guard** (`src/routes/_authenticated/route.tsx`): `beforeLoad` ensures a server-validated session via TanStack Query (`sessionQueryOptions`); missing/expired credentials clear local state and redirect to `/sign-in`.
- **MSW** (`src/mocks/`): dev-only handlers and demo accounts. The worker is started from `src/main.tsx` behind `import.meta.env.DEV` + a dynamic import, so `msw` is dead-code-eliminated from production builds (verified: no msw chunks in `dist/`). Set `VITE_ENABLE_MSW=false` to point development at a real service.
- **RBAC** (`src/features/auth/rbac.ts`): the server returns effective `permissions` with the session; the client only renders guards (`hasPermissions`, route `beforeLoad` checks, disabled buttons). Role→permission mapping exists **only** in the mock layer.

### Auth endpoints (mock contract)
| Method | Path | 说明 |
| --- | --- | --- |
| POST | `/auth/sign-in` | 校验演示账号，返回 `{ accessToken, user }`；失败返回 401 problem json |
| GET | `/auth/session` | 校验 Bearer 令牌与过期时间，返回当前用户（含 roles/permissions） |
| POST | `/auth/sign-out` | 登出，返回 204；客户端总是清理本地凭证 |

### Security decisions
- After login the app always lands on `/`; **no URL-borne redirect targets** exist (the old `/sign-in?redirect=…` param was removed) to eliminate open-redirect phishing vectors.
- The access token lives in a cookie purely for demo session continuity. Guards and route checks are UX only — server-side authorization is mandatory.
- 401 anywhere clears credentials, the query cache and redirects to sign-in; 403 surfaces a toast (routes redirect to `/403` where a permission guard fails).
- Demo passphrases are derived from the role name (`Admin123456` etc.), are public knowledge, and never enter the production bundle.

## Planned modules
- Foundation: layout, sidebar, themes, branding, simplified Chinese UI.
- Shared: HTTP errors, auth/session hooks, RBAC helpers, server-side DataTable patterns, validated forms, upload primitives.
- Demos: users, roles, audit logs.
- Contracts: OpenAPI and typed clients.
- Quality: Vitest, Playwright, CI.

## Security boundaries
Mocks are development-only. Real authentication and authorization are enforced by the backend. Never store production secrets in the repository or log sensitive fields.

## Scope exclusions for v0.1
No legacy GoFrame API compatibility, no database, no dedicated BFF, no dynamic form builder, no low-code engine, no microfrontend.
