# Branding and localization

Edit `src/config/app.ts` to configure the application name, subtitle, description, locale and demo user. At runtime, `src/main.tsx` synchronizes the document title and description.

Update `index.html` when customizing the static HTML fallback or social metadata, and replace `public/images/favicon.svg` to change the favicon. A default, self-contained SVG is used, without fetching external fonts.

The shell is Chinese-first (`zh-CN`). In v0.1 the dashboard, menus, login illustration and theme controls use Chinese copy; deeply nested users CRUD dialogs remain upstream examples until v0.2.

## Scope

This starter currently has **no real authentication backend**. The development-only sign-in demonstrates UI transitions and is disabled for production builds, where direct admin routes also redirect to sign-in. The `/_authenticated` layout is not a security boundary; real authentication and RBAC will arrive in issue #3. Never expose private data or deploy the demo as a secure administrative system.
