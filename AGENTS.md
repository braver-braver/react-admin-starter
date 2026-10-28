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
- Server-side authorization remains mandatory; client-side route and button guards are UX only.
- Prefer server-side pagination, filtering and sorting for administrative tables.
- Do not add a dependency when existing libraries or platform APIs suffice.

## Development practice
- Pin the upstream source commit and package manager lockfile before modifications.
- Keep changes focused and reviewable, use Conventional Commit messages.
- Require type checking, lint, tests and a production build before merging.
- Preserve MIT license and upstream acknowledgments.
- Document breaking changes and decisions in docs/.
- Never commit secrets or production user data.
