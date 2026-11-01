# Changelog

This file distinguishes **React Admin Starter** development from the release history of its [shadcn-admin upstream](https://github.com/satnaing/shadcn-admin). The source was imported at a pinned upstream commit; see [upstream provenance](docs/upstream.md).

**Release status:** Unreleased. The package version remains `0.1.0`. Milestones named v0.1 and v0.2 describe implemented functionality, **not** Git tags or GitHub Releases of this repository. No React Admin Starter GitHub Release has been published yet.

## Unreleased — React Admin Starter

This is the first release line of React Admin Starter: a Chinese-first admin template built on shadcn-admin. It has mock-first cookie sessions, server-driven CRUD, and system administration with data access scoped per capability. The API contract is frozen under `/api/v1` and the OpenAPI document is generated from it. A conformance suite and an integration guide help back ends implement it, and releases go through a checked process. If you integrated a back end against an earlier `main`, read the migration notes first.

### Migration notes

These changes are visible to anyone who built a back end or a client against an earlier `main`. Before v1.0.0, breaking changes are allowed but must be declared here. After v1.0.0 they go to a new `/api/v2` prefix ([AGENTS.md](AGENTS.md), [docs/releasing.md](docs/releasing.md)).

- **Paths moved under `/api/v1`** ([#65](https://github.com/braver-braver/react-admin-starter/issues/65)). Every endpoint moved from `/api/...` to `/api/v1/...`, for example `POST /api/auth/login` → `POST /api/v1/auth/login`, and the old paths are no longer served. A reverse proxy that forwards the `/api/` prefix keeps working unchanged.
- **Every write sends `X-Requested-With: ReactAdminStarter`** ([#32](https://github.com/braver-braver/react-admin-starter/issues/32)). A POST, PUT, PATCH or DELETE without it gets 403 `REQUEST_HEADER_REQUIRED`. The header is checked before the session, so an anonymous write without it now gets 403 rather than 401.
- **Multi-value query parameters use repeated keys only** ([#32](https://github.com/braver-braver/react-admin-starter/issues/32)). Send `status=active&status=invited`. The contract and the mock no longer read `status[]`, `role[]` or `action[]`.
- **The OpenAPI document is generated JSON** ([#31](https://github.com/braver-braver/react-admin-starter/issues/31)). `docs/api.openapi.json` (OpenAPI 3.1) replaces the hand-written `docs/api.openapi.yaml`. It is produced from `src/contract` by `pnpm contract:generate`, and CI fails when the two drift, so change the contract, not the file.
- **System-management operations have per-resource operationIds** ([#31](https://github.com/braver-braver/react-admin-starter/issues/31)). The single `/system/{resource}` operation with a `oneOf` body is replaced by one operation per resource and action, with its own request body: `listSystemAccounts`, `createSystemRole`, `updateSystemMenu`, `deleteSystemDepartment` and so on. Regenerate any client built from the old document.
- **Responses are parsed leniently, timestamps strictly** ([#27](https://github.com/braver-braver/react-admin-starter/issues/27)). Fields a back end adds to a response are ignored; before, one extra field in a system-management record failed with `INVALID_RESPONSE`. `createdAt` and `updatedAt` must be ISO 8601 date-time strings with a time zone, for example `2026-10-30T10:00:00Z`. `null`, numbers, booleans and strings without a time zone are now rejected. System-management request bodies stay strict and reject unknown fields.
- **System-management lists use the shared envelope** ([#29](https://github.com/braver-braver/react-admin-starter/issues/29)). The fields `data.total`, `data.page` and `data.pageSize` moved to `data.meta.total`, `data.meta.page` and `data.meta.pageSize`. There is a new `data.meta.totalPageCount`, always at least 1. `data.items` is unchanged; the user and audit-log lists already had this shape.
- **List limits are lenient** ([#30](https://github.com/braver-braver/react-admin-starter/issues/30)). On every list, the audit log included, a `pageSize` above 100 is clamped to 100 and an unknown `sortBy` falls back to `username`. Neither is rejected.
- **Names are sent already trimmed** ([#31](https://github.com/braver-braver/react-admin-starter/issues/31)). A system-management `name` must be at most 80 characters after trimming, and clients send it trimmed.

### Added

**Admin application**

- Chinese-first admin shell on a pinned, MIT-licensed shadcn-admin baseline, with collapsible navigation groups ([#1](https://github.com/braver-braver/react-admin-starter/issues/1), [#2](https://github.com/braver-braver/react-admin-starter/issues/2), [PR #22](https://github.com/braver-braver/react-admin-starter/pull/22)).
- Mock-first cookie sessions, authenticated routes and role-based access control ([#3](https://github.com/braver-braver/react-admin-starter/issues/3), [PR #7](https://github.com/braver-braver/react-admin-starter/pull/7)).
- Server-driven user CRUD with paging, filtering and sorting, plus uploads, an audit log, shared zh-CN strings and accessibility checks ([#4](https://github.com/braver-braver/react-admin-starter/issues/4), [#9](https://github.com/braver-braver/react-admin-starter/issues/9), [#10](https://github.com/braver-braver/react-admin-starter/issues/10)).
- System administration for accounts, roles, permissions, menus and departments, with server-issued navigation and data scopes computed per capability ([#20](https://github.com/braver-braver/react-admin-starter/issues/20), [PR #21](https://github.com/braver-braver/react-admin-starter/pull/21)).
- A GitHub Pages mock demo, plus snapshots of each Release that are never overwritten ([#14](https://github.com/braver-braver/react-admin-starter/issues/14), [#15](https://github.com/braver-braver/react-admin-starter/issues/15)).

**API contract (M1)**

- `src/contract/` is the single source of the API: Zod schemas, all 21 error codes and a registry of all 36 operations, each with its method, path, capability, CSRF requirement, success schema and declared errors ([#26](https://github.com/braver-braver/react-admin-starter/issues/26)).
- Validation rules for system management, users, invites, bulk status changes and list queries live in the contract. The client and the mock reuse them, so they cannot diverge ([#28](https://github.com/braver-braver/react-admin-starter/issues/28), [#30](https://github.com/braver-braver/react-admin-starter/issues/30)).
- The OpenAPI document is generated with `pnpm contract:generate`, and `pnpm contract:check` runs in CI ([#31](https://github.com/braver-braver/react-admin-starter/issues/31)). Contract scripts need Node 22.18 or later.
- Every client request goes through the registry with `callOperation(id, { params, query, body })`. Arguments and results are typed from the same entry, and a test stops application code from building `/api` paths by hand ([#33](https://github.com/braver-braver/react-admin-starter/issues/33)).
- A mock contract guard checks every mocked response against the registry: the status is declared, the body is `{ data }` matching the schema, and any error code is declared for that status. Every operation is exercised over HTTP with a success and a declared error ([#34](https://github.com/braver-braver/react-admin-starter/issues/34)).

**Conformance suite and back-end integration (M2)**

- A conformance suite in `src/contract/conformance/` runs the same scenarios against the mock and against any back end ([#36](https://github.com/braver-braver/react-admin-starter/issues/36)):
  - access checks derived from the registry for every operation ([#37](https://github.com/braver-braver/react-admin-starter/issues/37));
  - Tier 1 business scenarios ([#38](https://github.com/braver-braver/react-admin-starter/issues/38));
  - Tier 2 scenarios for every authorization rule, which create and remove their own fixtures through the system API ([#38](https://github.com/braver-braver/react-admin-starter/issues/38)).
- The mock runs every scenario as its own test and checks that the scenarios clean up after themselves ([#39](https://github.com/braver-braver/react-admin-starter/issues/39)).
- `pnpm test:contract` runs the suite against a real back end ([#40](https://github.com/braver-braver/react-admin-starter/issues/40)):
  - it is configured with `CONTRACT_BASE_URL` and three fixture accounts;
  - Tier 2 runs only with `CONTRACT_TIER2=1` on a disposable database;
  - it prints a summary per tier and can write a JSON report;
  - a skipped Tier 2 exits 3, not 0.
- A self-test proves the suite can fail. A stand-in back end (a test double, not a reference implementation) passes all of Tier 1, and five deliberately broken variants are each caught ([#41](https://github.com/braver-braver/react-admin-starter/issues/41)).
- An optional `VITE_API_PROXY_TARGET` proxies `/api` in `pnpm dev` and `pnpm preview`. An E2E test signs in to the production build against a same-origin API ([#42](https://github.com/braver-braver/react-admin-starter/issues/42)).
- The backend integration guide, [docs/backend-integration.md](docs/backend-integration.md), and the fixture checklist, [docs/conformance-fixtures.md](docs/conformance-fixtures.md), were independently reviewed: a reviewer who read only the docs implemented a back end that passes Tier 1 ([#43](https://github.com/braver-braver/react-admin-starter/issues/43)).

**Release engineering (M3)**

- [docs/releasing.md](docs/releasing.md) covers SemVer tied to the API freeze rules, `-rc.N` candidates, a pre-release checklist, and the release and recovery steps ([#46](https://github.com/braver-braver/react-admin-starter/issues/46)). Commitizen sets only the version (`cz bump --version-files-only`, `version_scheme: semver2`); this CHANGELOG stays handwritten.
- `pnpm release:check <tag>` checks the tag format, the `package.json` version, the CHANGELOG section and that the commit is on `main`. It reads the files at the tagged commit. The Pages workflow runs it before building any Release ([#47](https://github.com/braver-braver/react-admin-starter/issues/47)).

### Changed

- `pnpm knip` passes and runs in CI. It removed three unused components and the unused `recharts` and `date-fns` dependencies, and `pnpm lint` is warning-free ([#45](https://github.com/braver-braver/react-admin-starter/issues/45)).
- The mock no longer keeps a `password` sent with a business-user body. A bulk request whose `ids` is not an array selects nothing ([#30](https://github.com/braver-braver/react-admin-starter/issues/30)).

### Fixed

- The Pages workflow failed after #68 because the `releasePattern` export it imports had been removed. The export is restored, and `pnpm test:pages` now checks every name a workflow imports ([PR #73](https://github.com/braver-braver/react-admin-starter/pull/73)).

### Security

- The mock reference API enforces several rules: scope checks per operation, limits on what a role edit or account assignment can delegate, protected recovery records, and session revocation after a password reset or disable ([#20](https://github.com/braver-braver/react-admin-starter/issues/20)).
- Production builds never contain MSW, its handlers or demo credentials, and the build checks this every time. Desktop and mobile UI tests and privilege-escalation regression tests run in CI, and the Pages workflow smoke-tests the published site after every deployment.

### Documentation

- Contribution guide, pull-request template and issue templates rewritten for this project, in Chinese ([#44](https://github.com/braver-braver/react-admin-starter/issues/44)).
- The docs follow the frozen contract. `AGENTS.md` states the API compatibility rules, and the operation table in [docs/auth-and-api.md](docs/auth-and-api.md) is tested against the registry ([#35](https://github.com/braver-braver/react-admin-starter/issues/35)).
- The README separates development milestones from published versions. The API and security boundary of production builds is described in [architecture](docs/architecture.md) and [authentication](docs/auth-and-api.md).

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
