# React Admin Starter

A lightweight, Chinese-first, reusable React admin application based on [shadcn-admin](https://github.com/satnaing/shadcn-admin).

> **Status:** v0.1 Foundation. The shell is Chinese-first and the upstream demos are reduced to a minimal dashboard and user-table example. **MSW-backed session and RBAC examples are available in development; production requires a real same-origin auth API.**

## Tech stack

React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Router, TanStack Query, TanStack Table, React Hook Form, Zod and pnpm.

## Get started

Requires Node.js 22 and pnpm 10.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

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
- [x] v0.2: Development-only MSW APIs, authentication and RBAC reference implementation
- [ ] v0.2: Reusable server-side CRUD, uploads and audit-log examples
- [ ] v1.0: Stable API contract, documentation and template-quality release

See [engineering guidelines](AGENTS.md), [architecture](docs/architecture.md), [branding guide](docs/branding.md) and [upstream provenance](docs/upstream.md). Work is tracked in [GitHub Issues](https://github.com/braver-braver/react-admin-starter/issues).

See [API and authentication guide](docs/auth-and-api.md) for demo accounts, the API contract and production integration requirements.

## Design principles

- Backend-agnostic and Mock-first
- Feature-oriented structure, minimal abstractions
- Demo credentials and tokens must never become production defaults
- Server authorization is mandatory; client permission checks only improve UX
- No `face_system` or GoFrame-specific logic in this repository

## Attribution and license

Adapted from [Sat Naing's shadcn-admin](https://github.com/satnaing/shadcn-admin) at commit `e16c87f213a5ba5e45964e9b67c792105ec74d26`.

Licensed under the MIT License. See [LICENSE](LICENSE) for the original copyright notice and terms.

### 完整应用 E2E 与可访问性基线

```sh
pnpm install --frozen-lockfile
pnpm test:browser:install
pnpm test:e2e
```

`test:e2e` 先执行生产构建、类型检查和生产产物检查，再由 Playwright 独立启动开发 MSW 应用（5190）与生产预览（5191）。两个端口必须空闲，不复用已运行的开发服务。可使用 `pnpm test:e2e:ui` 交互调试；已有最新构建时可用 `pnpm exec playwright test --project=desktop` 定位单个项目。

套件以全新浏览器上下文覆盖 1440×900 桌面与 390×844 手机视口，验证登录/退出、会话刷新、工作台与用户页导航、只读/受限账户权限、命令面板、主题持久化、侧栏及键盘操作。使用仓库 MSW 演示账户，不需要真实凭据；不注入认证状态或拦截业务请求。生产预览单独验证不加载 MSW，缺少后端时演示账户无法登录，也不能访问受保护页面。

可访问性基线检查主要内容地标、页面标题、表单与图标按钮名称、跳过导航、Tab/Shift+Tab 焦点约束、Escape 关闭与焦点恢复。它不是完整 WCAG 审计，不覆盖屏幕阅读器实机体验、色彩对比度或所有业务表单。

CI 中 `Full application E2E smoke and accessibility baseline` 与组件测试分开显示，任何断言失败都会导致非零退出。失败时保存 7 天的 HTML 报告、截图与 trace；本地产物位于 `playwright-report/` 和 `test-results/`（不提交）。可用 `pnpm exec playwright show-report` 或 `pnpm exec playwright show-trace <trace.zip>` 查看。断言使用语义选择器和自动等待，不依赖固定延时、像素截图或动态用户日期。

### GitHub Pages 演示发布

独立演示构建 `pnpm build:demo` 输出到 `dist-demo/`，包含 MSW 与演示账户；普通 `pnpm build` 仍输出到 `dist/` 并禁止 Mock。`pnpm test:pages` 验证历史站点组装，`pnpm test:demo` 构建两个真实静态版本并验证桌面/手机的登录、刷新、退出和跨版本会话隔离。

配置 Pages 后，main 更新会发布最新演示，发布 `vMAJOR.MINOR.PATCH` 格式的 Release 会保存版本快照。具体设置、路径、首次发布与恢复方法见 [Pages 演示发布说明](docs/pages-demo.md)。
