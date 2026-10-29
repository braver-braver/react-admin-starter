# Architecture

## Objective

React Admin Starter is a lightweight, Chinese-first, backend-agnostic React admin application adapted from [shadcn-admin](https://github.com/satnaing/shadcn-admin), **not** a rewrite of face_system V1. GoFrame, Gin and other REST backends are consumers of its contract, not dependencies of this repository.

The v0.1 and v0.2 *development milestones* have been implemented, but this project has not published a GitHub Release. The package version remains `0.1.0`; v1.0 is a planned stabilization and release milestone. See the [README roadmap](../README.md#roadmap), [changelog](../CHANGELOG.md) and [upstream provenance](upstream.md). Do not treat upstream shadcn-admin version numbers as releases of this starter.

## Runtime architecture

React application → feature API functions → shared HTTP client → one of:

- **Development:** MSW handlers provide demonstrative same-origin `/api` endpoints and cookie-like browser sessions.
- **GitHub Pages demo:** a separate, version-scoped `build:demo` with hash routing, visible build provenance and browser-only mock data; this is not a secure multi-user service.
- **Production:** `pnpm build` creates `dist/` without MSW, demo credentials or mock handlers. A real same-origin REST backend must implement the documented API contract, enforce authentication/authorization, own sessions and persist data.

The frontend assumes an API response envelope of `{ "data": ... }` on success or `{ "error": { "code": "...", "message": "..." } }` with the appropriate HTTP status on failure. Authentication is based on cookie sessions and CSRF-protected writes; the implementation details remain backend-agnostic. See [API and authentication](auth-and-api.md) and [OpenAPI](api.openapi.yaml).

## Modules

- **Foundation:** layout, collapsible navigation groups and icon sidebar, themes, branding and simplified Chinese UI.
- **System:** login accounts, roles, permission catalog, menu and registered route IDs, departments and capability-specific data scopes.
- **Shared:** HTTP errors, session-aware state, permission helpers, URL-synchronized server-driven DataTable state, validated forms and upload primitives.
- **Examples:** users (server-side paginated CRUD and uploads), permissions and read-only audit logs.
- **Contracts:** OpenAPI specification, feature-local Zod schemas and typed API clients.
- **Quality:** Vitest browser tests, Playwright desktop/mobile and demo smoke tests, CI and production-boundary checks.

## Navigation and authorization boundaries

`/api/auth/navigation` supplies the menu data. The frontend may render only registered routes and capabilities authorized by the server-issued session, without treating menu visibility as proof of API access. The sidebar's group expansion state and compact icon mode affect presentation only, never the permissions or routes granted to the user.

Each account belongs to one department and may hold multiple roles. Authorization is calculated **per capability**: permission grants and their `dataScopes[permission]` are not interchangeable across read and write operations. Role or department changes must not silently widen permissions, routes or data scopes beyond an administrator's own grants. The real API must independently enforce record-level and batch-level scope checks, including filtering before pagination and counts. See [system management and authorization](system-management.md).

## Security boundaries

The browser mock environment is for development, testing and public demonstrations only. It is not a production authentication service or a source of trustworthy authorization. Never commit real credentials, expose mock authentication in the production bundle, or trust client-side roles, departments and route metadata as an authorization decision.

The real backend is responsible for strong password handling, `HttpOnly; Secure; SameSite` session cookies, login-session rotation, revocation, CSRF/Origin verification, rate limiting, database transactions, per-operation authorization and audit records. A static deployment without a compatible backend does not provide a working production admin login.

## Verification and delivery

The CI pipeline runs Lint, Prettier, Vitest, production build/type checking, production mock-isolation checks, desktop/mobile Playwright E2E, Pages assembly and version-isolation tests. A merge to `main` updates the separate **latest mock demo** after the deployment and public-browser verification workflow succeeds; this is not the same as publishing a GitHub Release.

Release-tag snapshots under `releases/<tag>/` are designed to preserve history, but their end-to-end behavior with actual releases remains tracked by [Issue #15](https://github.com/braver-braver/react-admin-starter/issues/15). Before v1.0, stabilize the OpenAPI/Zod/API behavior, backend integration guide, version metadata and release checks.

## Scope exclusions

The starter does not bundle a GoFrame/Gin server, production database, legacy face_system integration, dedicated BFF, dynamic runtime code loading, form builder, low-code engine or microfrontend framework. Business-specific integration belongs in the consuming application.
