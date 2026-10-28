# Architecture

## Objective
A reusable React Admin Starter, **not** a rewrite of face_system V1.

## Runtime architecture
React application → feature API functions → shared HTTP client → MSW development handlers or a configurable REST service.

No backend runtime is required for local demo mode. GoFrame, Gin and other backends are future consumers of the API contract, not dependencies of the starter.

## Modules
- Foundation: layout, sidebar, themes, branding, simplified Chinese UI.
- Shared: HTTP errors, cookie sessions, RBAC helpers, URL-synced server-driven DataTable state, validated forms, upload primitives.
- Demos: users (server-side CRUD with RBAC), permissions, audit logs (read-only, `audit:read`).
- Contracts: OpenAPI (`docs/api.openapi.yaml`) and Zod-validated typed clients per feature.
- Quality: Vitest browser mode, Playwright, CI, production boundary check for mock artifacts.

## Security boundaries
Mocks are development-only. Real authentication and authorization are enforced by the backend. Never store production secrets in the repository or log sensitive fields.

## Scope exclusions for v0.1
No legacy GoFrame API compatibility, no database, no dedicated BFF, no dynamic form builder, no low-code engine, no microfrontend.
