# Branding and localization

Edit `src/config/app.ts` to configure the application name, subtitle, description, locale and demo user. At runtime, `src/main.tsx` synchronizes the document title and description.

Update `index.html` when customizing the static HTML fallback or social metadata, and replace `public/images/favicon.svg` to change the favicon. A default, self-contained SVG is used, without fetching external fonts.

The shell is Chinese-first (`zh-CN`). In v0.1 the dashboard, menus, login illustration and theme controls use Chinese copy; deeply nested users CRUD dialogs remain upstream examples until v0.2.

## Scope

Development uses MSW-backed session and RBAC examples. Production excludes mock handlers and requires a real same-origin API before admin routes can load. Client guards are UX controls; backend authentication and authorization remain mandatory. See [API and authentication](auth-and-api.md).
