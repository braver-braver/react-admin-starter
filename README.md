# React Admin Starter

A lightweight, Chinese-first, reusable React admin application based on [shadcn-admin](https://github.com/satnaing/shadcn-admin).

> **Status:** v0.2 feature scope implemented on `main`, but not yet published as a GitHub Release. The package version remains `0.1.0`. Development and demo builds use MSW-backed cookie sessions, RBAC, CRUD, uploads and audit examples; production requires a real same-origin API with server-side authorization.

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

开发阶段的 `v0.1` / `v0.2` 表示已实现的功能范围，**不代表已经发布 Git Tag 或 GitHub Release**。下表以 `main` 上的代码、PR / Issue 状态及实际发布验收为准（更新于 2026-10-29）。

| 里程碑 | 主要交付与验收标准 | 状态 | 跟踪 |
| --- | --- | --- | --- |
| 基线导入 | 固定 shadcn-admin 上游提交，保留资源、署名与 MIT License | 已完成 · 已合并 | [#1](https://github.com/braver-braver/react-admin-starter/issues/1) · [PR #5](https://github.com/braver-braver/react-admin-starter/pull/5) |
| v0.1 · 管理端外壳 | 精简非通用页面、中文优先界面、品牌及导航基础 | 已完成 · 已合并 | [#2](https://github.com/braver-braver/react-admin-starter/issues/2) · [#10](https://github.com/braver-braver/react-admin-starter/issues/10) |
| v0.2 · Mock API 与认证 | 开发环境 MSW、Cookie Session、RBAC 及受保护路由 | 已完成 · 已合并 | [#3](https://github.com/braver-braver/react-admin-starter/issues/3) · [PR #8](https://github.com/braver-braver/react-admin-starter/pull/8) |
| v0.2 · 通用业务示例与质量基线 | 服务端分页 CRUD、文件上传、审计日志、桌面/手机 E2E 与可访问性基线 | 已完成 · 已合并 | [#4](https://github.com/braver-braver/react-admin-starter/issues/4) · [#9](https://github.com/braver-braver/react-admin-starter/issues/9) |
| v0.2 · 系统管理与统一授权 | 账号、角色、权限、菜单、部门管理；动态路由、按能力的数据范围及越权回归测试 | 已完成 · 已合并 | [#20](https://github.com/braver-braver/react-admin-starter/issues/20) · [PR #21](https://github.com/braver-braver/react-admin-starter/pull/21) |
| Pages 演示基础设施 | 独立静态 Mock 演示、`latest` 在线验证、Release 版本快照构建与隔离测试 | 代码已完成 · 线上 latest 已验收 | [#14](https://github.com/braver-braver/react-admin-starter/issues/14) · [PR #16](https://github.com/braver-braver/react-admin-starter/pull/16) |
| 导航交互完善 | 工作区、系统管理、业务示例分组折叠；图标栏与桌面/手机 E2E | 进行中 · PR 待合并 | [PR #22](https://github.com/braver-braver/react-admin-starter/pull/22)；合并后验收 [Pages](https://braver-braver.github.io/react-admin-starter/) |
| v1.0 · API 契约稳定化 | 对齐 OpenAPI、Zod、MSW 与文档；核验会话、CSRF、401/403、动态导航和数据范围契约，补齐真实后端接入指南 | 计划中 · 待拆分任务 | [接口文档](docs/auth-and-api.md) · [OpenAPI](docs/api.openapi.yaml) |
| v1.0 · 模板质量与正式发布 | 对齐包版本与 Git Tag；通过 Lint、格式、类型检查、单元/E2E、生产 Mock 隔离及 Pages 线上验收后发布首个正式版本 | 计划中 · 尚无 Release | [工程规范](AGENTS.md) · [发布说明](docs/pages-demo.md) |
| Release 历史快照验收 | 使用真实 Release 验证 `releases/<tag>/`、版本索引及不同版本的历史保留；不能以合成测试版本代替 | 待验收 · 需真实 Release | [#15](https://github.com/braver-braver/react-admin-starter/issues/15) |

**下一步顺序：** 复审并合并 PR #22 → 验收最新 Pages 导航 → 冻结 v1.0 API 契约与接入文档 → 对齐版本并发布真实 Release → 完成 #15 的版本快照验收。面向 GoFrame 等具体后端的业务集成属于脚手架的消费项目，不在此仓库内引入生产后端。

See [engineering guidelines](AGENTS.md), [architecture](docs/architecture.md), [branding guide](docs/branding.md) and [upstream provenance](docs/upstream.md). Work is tracked in [GitHub Issues](https://github.com/braver-braver/react-admin-starter/issues).

See [API and authentication guide](docs/auth-and-api.md) for demo accounts, the API contract and production integration requirements. See the [localization guide](docs/i18n.md) for shared strings and `Intl` conventions, and the [Pages demo guide](docs/pages-demo.md) for the separately isolated public mock demo and release snapshots.

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

## 静态演示与版本预览

普通生产构建使用 `pnpm build`，始终排除演示账户与 MSW。仅用于公开展示的静态演示使用 `pnpm build:demo`，通过版本路径与生产 API 隔离。

```sh
pnpm test:pages
pnpm test:demo
```

GitHub Pages 需要仓库管理员启用后才会部署；历史快照遵循不可覆写的 Release 版本约束。详见 [部署与恢复](docs/pages-demo.md)。

### 系统管理与权限框架

系统管理提供登录用户、角色、权限、菜单及部门页面，导航由 API 下发。账号归属一个部门并关联多个角色，页面入口、按钮与 API 复用能力代码；数据范围按能力分别计算，覆盖全部、本部门、本部门及下级、本人和指定部门。业务用户 CRUD 验证范围过滤及单条/批量操作隔离。

见 [系统管理与统一授权](docs/system-management.md) 了解数据关系、路由白名单、会话吊销、API 契约与 Mock/真实后端边界。
