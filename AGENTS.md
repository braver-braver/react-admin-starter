# Engineering Guidelines

## Project purpose
Build a lightweight, reusable, Chinese-first React admin starter independent of any particular Go backend. The first implementation is based on satnaing/shadcn-admin, whose MIT license and attribution must be retained.

## Architectural rules
- Prefer React, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Router, Query and Table.
- Keep the repository as one application; no monorepo, microfrontend or unnecessary abstraction.
- Keep reusable infrastructure separate from example business features.
- Use feature-oriented folders and colocate schemas, API functions and components.
- Use Mock Service Worker for demos and tests; production must not contain mock authentication bypass.
- Use a small API adapter, typed contracts and clear error handling. Do not hardcode GoFrame-specific response semantics in shared UI.
- Auth API uses same-origin Cookie sessions and Zod-validated response envelopes; see docs/auth-and-api.md and docs/api.openapi.json. The Zod contract in src/contract is the single source: regenerate the OpenAPI file with `pnpm contract:generate` after changing it; CI runs `pnpm contract:check` and fails on drift.
- Serve MSW through Vite development middleware or the explicit build:demo static artifact. Never copy it to public/ or ordinary production artifacts. Demo output uses hash routing, scoped worker/API/session paths and a visible versioned demo banner; keep production checks independent.
- Server-side authorization remains mandatory; client-side route and button guards are UX only.
- Prefer server-side pagination, filtering and sorting for administrative tables.
- System authorization binds accounts to departments and roles; compute data scopes separately for each capability. Never combine read-all with write-self into write-all. Filter before counts/pagination and reject mixed-scope batches atomically.
- Dynamic navigation uses registered route IDs; require server-issued routes before rendering protected pages. Hidden navigation does not grant/revoke API permission. See docs/system-management.md.
- Keep bootstrap admin/recovery entries protected, references acyclic, credentials out of account DTOs/audit, and revoked sessions invalid after re-enabling.
- Role edits and account assignments must not delegate capabilities, data scopes or routes beyond the actor's grants. Self-scoped account edits cannot change departments; system reference options follow resource read grants.
- Reparenting or enabling an existing department may indirectly widen descendant scopes; verify newly gained permissions, scopes and routes for affected accounts against the editor's pre-change grants.
- Do not add a dependency when existing libraries or platform APIs suffice.

## Development practice
- Pin the upstream source commit and package manager lockfile before modifications.
- Keep changes focused and reviewable, use Conventional Commit messages.
- Require type checking, lint, tests and a production build before merging.
- Preserve MIT license and upstream acknowledgments.
- Document breaking changes and decisions in docs/.
- Never commit secrets or production user data.
