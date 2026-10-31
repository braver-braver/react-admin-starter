# React Admin Starter

A lightweight, Chinese-first, reusable React admin application based on [shadcn-admin](https://github.com/satnaing/shadcn-admin).

> **状态：功能里程碑 v0.2 已实现，尚未发布正式 GitHub Release。** 当前 `package.json` 版本为 `0.1.0`；`v0.1` 与 `v0.2` 仅表示开发里程碑，并非已发布的 Tag/Release。开发环境与独立的 Pages 演示使用 MSW；普通生产构建不包含 Mock，必须接入真实的同源 API，由后端执行认证及权限校验。

## Tech stack

React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Router, TanStack Query, TanStack Table, React Hook Form, Zod and pnpm.

## Get started

Requires Node.js 22.18 or later and pnpm 10. The contract scripts (`pnpm contract:generate`, `pnpm contract:check`) load the TypeScript contract directly, which needs Node's native type stripping (22.18+).

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

开发阶段的 `v0.1` / `v0.2` 表示已实现的功能范围，**不代表已经发布 Git Tag 或 GitHub Release**。下表以 `main` 上的代码、PR / Issue 状态及实际发布验收为准（更新于 2026-10-31）。

<!-- prettier-ignore -->
| 里程碑 | 主要交付与验收标准 | 状态 | 跟踪 |
| --- | --- | --- | --- |
| 基线导入 | 固定 shadcn-admin 上游提交，保留资源、署名与 MIT License | 已完成 · 已合并 | [#1](https://github.com/braver-braver/react-admin-starter/issues/1) · [PR #5](https://github.com/braver-braver/react-admin-starter/pull/5) |
| v0.1 · 管理端外壳 | 精简非通用页面、中文优先界面、品牌及导航基础 | 已完成 · 已合并 | [#2](https://github.com/braver-braver/react-admin-starter/issues/2) · [#10](https://github.com/braver-braver/react-admin-starter/issues/10) |
| v0.2 · Mock API 与认证 | 开发环境 MSW、Cookie Session、RBAC 及受保护路由 | 已完成 · 已合并 | [#3](https://github.com/braver-braver/react-admin-starter/issues/3) · [PR #7](https://github.com/braver-braver/react-admin-starter/pull/7) |
| v0.2 · 通用业务示例与质量基线 | 服务端分页 CRUD、文件上传、审计日志、桌面/手机 E2E 与可访问性基线 | 已完成 · 已合并 | [#4](https://github.com/braver-braver/react-admin-starter/issues/4) · [#9](https://github.com/braver-braver/react-admin-starter/issues/9) |
| v0.2 · 系统管理与统一授权 | 账号、角色、权限、菜单、部门管理；动态路由、按能力的数据范围及越权回归测试 | 已完成 · 已合并 | [#20](https://github.com/braver-braver/react-admin-starter/issues/20) · [PR #21](https://github.com/braver-braver/react-admin-starter/pull/21) |
| Pages 演示基础设施 | 独立静态 Mock 演示、`latest` 在线验证、Release 版本快照构建与隔离测试 | 代码已完成 · 线上 latest 已验收 | [#14](https://github.com/braver-braver/react-admin-starter/issues/14) · [PR #16](https://github.com/braver-braver/react-admin-starter/pull/16) |
| 导航交互完善 | 工作区、系统管理、业务示例分组折叠；图标栏与桌面/手机 E2E | 已完成 · 已合并 | [PR #22](https://github.com/braver-braver/react-admin-starter/pull/22)；合并后验收 [Pages](https://braver-braver.github.io/react-admin-starter/) |
| v1.0 · M1 API 契约冻结 | Zod 契约为唯一来源；生成 OpenAPI 并在 CI 检查漂移；路径统一为 `/api/v1`；客户端经注册表发请求；Mock 契约守卫；冻结规则 | 已完成 · 已合并 | [M1](https://github.com/braver-braver/react-admin-starter/milestone/1) · [接口文档](docs/auth-and-api.md) · [OpenAPI](docs/api.openapi.json) |
| v1.0 · M2 一致性套件与接入指南 | 同一套用例跑 Mock 与真实后端（Tier 1/2）；替身服务器自检；生产构建加同源 API 的 E2E；后端接入指南 | 已完成 · 已合并 | [M2](https://github.com/braver-braver/react-admin-starter/milestone/2) · [后端接入指南](docs/backend-integration.md) · [夹具清单](docs/conformance-fixtures.md) |
| v1.0 · M3 发布工程 | 版本号与 CHANGELOG 流程、发布前检查 | 下一步 · 已拆分任务 | [M3](https://github.com/braver-braver/react-admin-starter/milestone/3) |
| v1.0 · 模板质量与正式发布 | 对齐包版本与 Git Tag；通过 Lint、格式、类型检查、单元/E2E、生产 Mock 隔离及 Pages 线上验收后发布首个正式版本 | 计划中 · 尚无 Release | [工程规范](AGENTS.md) · [发布说明](docs/pages-demo.md) |
| Release 历史快照验收 | 使用真实 Release 验证 `releases/<tag>/`、版本索引及不同版本的历史保留；不能以合成测试版本代替 | 待验收 · 需真实 Release | [#15](https://github.com/braver-braver/react-admin-starter/issues/15) |

**下一步顺序：** M3 发布工程（版本、CHANGELOG、发布检查）→ 发布真实 Release 并完成 #15 的版本快照验收（M4）。面向 GoFrame 等具体后端的业务集成属于脚手架的消费项目，不在此仓库内引入生产后端。

See [engineering guidelines](AGENTS.md), [architecture](docs/architecture.md), [changelog](CHANGELOG.md), [branding guide](docs/branding.md) and [upstream provenance](docs/upstream.md). Work is tracked in [GitHub Issues](https://github.com/braver-braver/react-admin-starter/issues).

See [API and authentication guide](docs/auth-and-api.md) for demo accounts, the API contract and production integration requirements. To implement a back end, follow the [backend integration guide](docs/backend-integration.md) (中文：[后端接入指南](docs/backend-integration.md)): session and CSRF rules, the authorization model, deployment, and how to verify it with `pnpm test:contract`. See the [localization guide](docs/i18n.md) for shared strings and `Intl` conventions, and the [Pages demo guide](docs/pages-demo.md) for the separately isolated public mock demo and release snapshots.

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

`test:e2e` 先执行生产构建、类型检查和生产产物检查，再由 Playwright 独立启动开发 MSW 应用（5190）、无后端的生产预览（5191）、一致性套件的替身服务器（5194），以及把 `/api` 代理到替身的生产预览（5193）。这些端口必须空闲，不复用已运行的开发服务。可使用 `pnpm test:e2e:ui` 交互调试；已有最新构建时可用 `pnpm exec playwright test --project=desktop` 定位单个项目。

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
