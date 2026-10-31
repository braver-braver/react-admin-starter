# Changelog

This file distinguishes **React Admin Starter** development from the release history of its [shadcn-admin upstream](https://github.com/satnaing/shadcn-admin). The source was imported at a pinned upstream commit; see [upstream provenance](docs/upstream.md).

**Release status:** Unreleased. The package version remains `0.1.0`. Milestones named v0.1 and v0.2 describe implemented functionality, **not** Git tags or GitHub Releases of this repository. No React Admin Starter GitHub Release has been published yet.

## Unreleased — React Admin Starter

### Added

- Imported the pinned, MIT-licensed shadcn-admin baseline and built a simplified Chinese-first admin shell ([#1](https://github.com/braver-braver/react-admin-starter/issues/1), [#2](https://github.com/braver-braver/react-admin-starter/issues/2)).
- Added mock-first cookie sessions, authenticated routes and role-based access control ([#3](https://github.com/braver-braver/react-admin-starter/issues/3), [PR #7](https://github.com/braver-braver/react-admin-starter/pull/7)).
- Added reusable server-driven user CRUD, uploads, audit logs, shared localization and browser accessibility coverage ([#4](https://github.com/braver-braver/react-admin-starter/issues/4), [#9](https://github.com/braver-braver/react-admin-starter/issues/9), [#10](https://github.com/braver-braver/react-admin-starter/issues/10)).
- Added system administration for accounts, roles, permissions, menus and departments, with server-issued navigation and capability-specific data scopes ([#20](https://github.com/braver-braver/react-admin-starter/issues/20), [PR #21](https://github.com/braver-braver/react-admin-starter/pull/21)).
- Added independently built GitHub Pages mock previews and version-scoped snapshot infrastructure; authentic Release history is still awaiting verification ([#14](https://github.com/braver-braver/react-admin-starter/issues/14), [#15](https://github.com/braver-braver/react-admin-starter/issues/15)).
- Added collapsible navigation groups while preserving icon-only sidebar access ([PR #22](https://github.com/braver-braver/react-admin-starter/pull/22)).
- Added `src/contract/`: the Zod schemas, a table of all 21 API error codes and a registry of all 36 API operations (method, path, capability, CSRF, success schema, declared errors). Feature schema files re-export it, so UI imports are unchanged. This is the first step toward generating the OpenAPI document from code; no runtime behaviour changes ([#26](https://github.com/braver-braver/react-admin-starter/issues/26), M1-T1).
- Made API responses tolerant of fields added by a backend (system-management records previously inherited strict parsing, so one extra field failed with `INVALID_RESPONSE`), while request bodies for system management stay strict. Timestamps are now validated as ISO 8601 date-time strings; `null`, numbers and booleans are no longer accepted as dates ([#27](https://github.com/braver-braver/react-admin-starter/issues/27), M1-T2).
- Stated the system-management validation rules in the contract so the generated OpenAPI document can carry them: id lists are marked `uniqueItems`, and the rules that JSON Schema cannot express (a `custom` data scope needs departments, account emails are lower-cased, the initial password is required only on create) are written as descriptions. A test per rule checks both the described constraint and that the runtime enforces it ([#28](https://github.com/braver-braver/react-admin-starter/issues/28), M1-T3).
- Moved the request-side rules for users into the contract: user create/update bodies, invites, bulk status changes and the users/audit list queries are now Zod schemas registered on their operations, and the client and the mock handlers reuse them instead of hand-written checks. Behaviour changes: the audit list now caps `pageSize` at 100 like the users list (decision D3), the mock no longer keeps any `password` sent with a business-user body, and a bulk request whose `ids` is not an array selects nothing (non-string entries inside the array are skipped, as before). The list queries clamp `pageSize` above 100 to 100 and fall back to `username` for an unknown `sortBy`, in the contract as well as in the mock (decisions D3 and D6). Error codes and messages are unchanged ([#30](https://github.com/braver-braver/react-admin-starter/issues/30), M1-T4).
- Fixed the request conventions for list queries and headers in the contract, the docs and the mock: multi-value query parameters use repeated keys only (`status=a&status=b`; `status[]`, `role[]` and `action[]` are no longer read), and every write (POST, PUT, PATCH, DELETE) must send `X-Requested-With: ReactAdminStarter`, otherwise it gets 403 `REQUEST_HEADER_REQUIRED`. The header is checked before the session, so an anonymous write without it now gets that 403 rather than 401 ([#32](https://github.com/braver-braver/react-admin-starter/issues/32), M1-T6).
- Unified every paged list on one envelope, `{ items, meta: { page, pageSize, total, totalPageCount } }`, built from a single `listEnvelope` in the contract. The system-management lists were the last ones using the flat shape; see the migration notes below ([#29](https://github.com/braver-braver/react-admin-starter/issues/29), M1-T3b, decision D2). Breaking change.
- Moved every API path under the versioned prefix `/api/v1` (decision D5). The prefix is one constant, `API_PREFIX` in `src/contract/common.ts`, shared by the client, the mock handlers and the OpenAPI document; feature code passes paths relative to it. The unversioned `/api/...` paths are no longer served ([#65](https://github.com/braver-braver/react-admin-starter/issues/65), M1-T4b). Breaking change.
- Generated the OpenAPI document from the contract: `docs/api.openapi.json` (OpenAPI 3.1, decision D1) replaces the hand-written `docs/api.openapi.yaml`. `pnpm contract:generate` writes it, `pnpm contract:check` fails when it differs from `src/contract`, and CI runs the check after Lint. Every operation lists exactly the error codes it may return per status; timestamps are `string`/`date-time`; request bodies are strict and responses open; names must be sent already trimmed (decision D7). Contract scripts need Node 22.18 or later ([#31](https://github.com/braver-braver/react-admin-starter/issues/31), M1-T5).

### Security and quality

- Enforced operation-specific scope checks, delegated permission and route ceilings, protected recovery records and session revocation in the mock reference API.
- Added desktop/mobile UI checks, privilege-escalation regression coverage, production mock isolation and published Pages browser smoke tests.
- Made `pnpm knip` pass and run in CI: knip now sees the route files, the Playwright config and E2E specs and the demo server script; removed three unused components and the unused `recharts` and `date-fns` dependencies; dependencies used only by the kept shadcn primitives are listed with the reason. `pnpm lint` is warning-free ([#45](https://github.com/braver-braver/react-admin-starter/issues/45), M3-T2).

### Migration notes

Breaking changes for anyone integrating against the API, listed per change.

- **OpenAPI file**, M1-T5: `docs/api.openapi.yaml` is replaced by the generated `docs/api.openapi.json`. System-management operations have per-resource ids (`listSystemAccounts`, `createSystemRole`, …) and request bodies, instead of one `/system/{resource}` path with a `oneOf` body.
- **Names**, M1-T5: send system-management `name` values already trimmed (at most 80 characters).
- **API paths**, M1-T4b: every endpoint moves from `/api/...` to `/api/v1/...` (for example `POST /api/auth/login` → `POST /api/v1/auth/login`). The old paths are not served. A reverse proxy that forwards the `/api/` prefix keeps working unchanged. Breaking changes after v1.0 will use a new `/api/v2` prefix.

- **System-management list responses** (`GET /api/system/{accounts,roles,permissions,menus,departments}`), M1-T3b:
  - `data.total` → `data.meta.total`
  - `data.page` → `data.meta.page`
  - `data.pageSize` → `data.meta.pageSize`
  - new: `data.meta.totalPageCount` (always at least 1)
  - `data.items` is unchanged. The users and audit-log lists already used this shape.
- **Audit-log list**, M1-T4: `pageSize` is capped at 100 like the other lists; larger values are clamped, not rejected.
- **Write requests**, M1-T6: every POST/PUT/PATCH/DELETE must send `X-Requested-With: ReactAdminStarter`; without it the server answers 403 `REQUEST_HEADER_REQUIRED` before any session check (an anonymous write used to get 401).
- **Multi-value query parameters**, M1-T6: use repeated keys (`status=a&status=b`); the `status[]`, `role[]` and `action[]` spellings are no longer read.

### Documentation

- Clarified development milestones versus published versions and tracked pending v1.0 contract and release-readiness work in the [README](README.md).
- Documented the production API/security boundary in [architecture](docs/architecture.md) and [authentication](docs/auth-and-api.md).

---

## Historical upstream changelog — shadcn-admin only

**The entries below are retained verbatim from the imported upstream project. Their version numbers (including v2.2.1) are not React Admin Starter releases.** See [upstream provenance](docs/upstream.md) for the pinned source.

## v2.2.1 (2025-11-06)

### Fix

- **style**: update data attribute class in authenticated layout (#249)
- prevent navigation to 500 page during development (#240)
- **style**: apply variant 'destructive' to sign-out buttons (#236)
- add missing space in profile form (#235)

### Refactor

- enhance tables and update table layout (#234)

## v2.2.0 (2025-10-09)

### Feat

- add analytics tab in dashboard page (#220)
- add extra AppTitle component for sidebar header (#216)
- update 2-column sign in page (#213)

### Fix

- update sidebar menu chevron direction in RTL mode (#229)
- pagination button spacing (#215)
- upgrade lucide-react to solve antivirus warning (#211)

### Refactor

- move sidebar related components into app-sidebar
- change SidebarInset component from 'main' to 'div'
- replace extra main container query with content container query
- replace inline svg logo with logo component (#214)

## v2.1.0 (2025-08-23)

### Feat

- enhance data table pagination with page numbers (#207)
- enhance auth flow with sign-out dialogs and redirect functionality (#206)

### Refactor

- reorganize utility files into `lib/` folder (#209)
- extract data-table components and reorganize structure (#208)

## v2.0.0 (2025-08-16)

### BREAKING CHANGE

- CSS file structure has been reorganized

### Feat

- add search param sync in apps route (#200)
- improve tables and sync table states with search param (#199)
- add data table bulk action toolbar (#196)
- add config drawer and update overall layout (#186)
- RTL support (#179)

### Fix

- adjust layout styles in search and top nav in dashboard page
- update spacing and layout styles
- update faceted icon color
- improve user table hover & selected styles (#195)
- add max-width for large screens to improve responsiveness (#194)
- adjust chat border radius for better responsiveness (#193)
- update hard-coded or inconsistent colors (#191)
- use variable for inset layout height calculation
- faded-bottom overflow issue in inset layout
- hide unnecessary configs on mobile (#189)
- adjust file input text vertical alignment (#188)

### Refactor

- enforce consistency and code quality (#198)
- improve code quality and consistency (#197)
- update error routes (#192)
- remove DirSwitch component and its usage in Tasks (#190)
- standardize using cookie as persist state (#187)
- separate CSS into modular theme and base styles (#185)
- replace tabler icons with lucide icons (#183)

## v1.4.2 (2025-07-23)

### Fix

- remove unnecessary transitions in table (#176)
- overflow background in tables (#175)

## v1.4.1 (2025-06-25)

### Fix

- user list overflow in chat (#160)
- prevent showing collapsed menu on mobile (#155)
- white background select dropdown in dark mode (#149)

### Refactor

- update font config guide in fonts.ts (#164)

## v1.4.0 (2025-05-25)

### Feat

- **clerk**: add Clerk for auth and protected route (#146)

### Fix

- add an indicator for nested pages in search (#147)
- update faded-bottom color with css variable (#139)

## v1.3.0 (2025-04-16)

### Fix

- replace custom otp with input-otp component (#131)
- disable layout animation on mobile (#130)
- upgrade react-day-picker and update calendar component (#129)

### Others

- upgrade Tailwind CSS to v4 (#125)
- upgrade dependencies (#128)
- configure automatic code-splitting (#127)

## v1.2.0 (2025-04-12)

### Feat

- add loading indicator during page transitions (#119)
- add light favicons and theme-based switching (#112)
- add new chat dialog in chats page (#90)

### Fix

- add fallback font for fontFamily (#110)
- broken focus behavior in add user dialog (#113)

## v1.1.0 (2025-01-30)

### Feat

- allow changing font family in setting

### Fix

- update sidebar color in dark mode for consistent look (#87)
- use overflow-clip in table paginations (#86)
- **style**: update global scrollbar style (#82)
- toolbar filter placeholder typo in user table (#76)

## v1.0.3 (2024-12-28)

### Fix

- add gap between buttons in import task dialog (#70)
- hide button sort if column cannot be hidden & update filterFn (#69)
- nav links added in profile dropdown (#68)

### Refactor

- optimize states in users/tasks context (#71)

## v1.0.2 (2024-12-25)

### Fix

- update overall layout due to scroll-lock bug (#66)

### Refactor

- analyze and remove unused files/exports with knip (#67)

## v1.0.1 (2024-12-14)

### Fix

- merge two button components into one (#60)
- loading all tabler-icon chunks in dev mode (#59)
- display menu dropdown when sidebar collapsed (#58)
- update spacing & alignment in dialogs/drawers
- update border & transition of sticky columns in user table
- update heading alignment to left in user dialogs
- add height and scroll area in user mutation dialogs
- update `/dashboard` route to just `/`
- **build**: replace require with import in tailwind.config.js

### Refactor

- remove unnecessary layout-backup file

## v1.0.0 (2024-12-09)

### BREAKING CHANGE

- Restructured the entire folder
hierarchy to adopt a feature-based structure. This
change improves code modularity and maintainability
but introduces breaking changes.

### Feat

- implement task dialogs
- implement user invite dialog
- implement users CRUD
- implement global command/search
- implement custom sidebar trigger
- implement coming-soon page

### Fix

- uncontrolled issue in account setting
- card layout issue in app integrations page
- remove form reset logic from useEffect in task import
- update JSX types due to react 19
- prevent card stretch in filtered app layout
- layout wrap issue in tasks page on mobile
- update user column hover and selected colors
- add setTimeout in user dialog closing
- layout shift issue in dropdown modal
- z-axis overflow issue in header
- stretch search bar only in mobile
- language dropdown issue in account setting
- update overflow contents with scroll area

### Refactor

- update layouts and extract common layout
- reorganize project to feature-based structure

## v1.0.0-beta.5 (2024-11-11)

### Feat

- add multiple language support (#37)

### Fix

- ensure site syncs with system theme changes (#49)
- recent sales responsive on ipad view (#40)

## v1.0.0-beta.4 (2024-09-22)

### Feat

- upgrade theme button to theme dropdown (#33)
- **a11y**: add "Skip to Main" button to improve keyboard navigation (#27)

### Fix

- optimize onComplete/onIncomplete invocation (#32)
- solve asChild attribute issue in custom button (#31)
- improve custom Button component (#28)

## v1.0.0-beta.3 (2024-08-25)

### Feat

- implement chat page (#21)
- add 401 error page (#12)
- implement apps page
- add otp page

### Fix

- prevent focus zoom on mobile devices (#20)
- resolve eslint script issue (#18)
- **a11y**: update default aria-label of each pin-input
- resolve OTP paste issue in multi-digit pin-input
- update layouts and solve overflow issues (#11)
- sync pin inputs programmatically

## v1.0.0-beta.2 (2024-03-18)

### Feat

- implement custom pin-input component (#2)

## v1.0.0-beta.1 (2024-02-08)

### Feat

- update theme-color meta tag when theme is updated
- add coming soon page in broken pages
- implement tasks table and page
- add remaining settings pages
- add example error page for settings
- update general error page to be more flexible
- implement settings layout and settings profile page
- add error pages
- add password-input custom component
- add sign-up page
- add forgot-password page
- add box sign in page
- add email + password sign in page
- make sidebar responsive and accessible
- add tailwind prettier plugin
- make sidebar collapsed state in local storage
- add check current active nav hook
- add loader component ui
- update dropdown nav by default if child is active
- add main-panel in dashboard
- **ui**: add dark mode
- **ui**: implement side nav ui

### Fix

- update incorrect overflow side nav height
- exclude shadcn components from linting and remove unused props
- solve text overflow issue when nav text is long
- replace nav with dropdown in mobile topnav
- make sidebar scrollable when overflow
- update nav link keys
- **ui**: update label style

### Refactor

- move password-input component into custom component dir
- add custom button component
- extract redundant codes into layout component
- update react-router to use new api for routing
- update main panel layout
- update major layouts and styling
- update main panel to be responsive
- update sidebar collapsed state to false in mobile
- update sidebar logo and title
- **ui**: remove unnecessary spacing
- remove unused files
