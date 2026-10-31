# 参与贡献 React Admin Starter

感谢你愿意参与。本项目是中文优先、Mock 优先、可对接真实后端的 React 管理端模板。下面的规则让多人（包括 AI agent）并行工作时，产出的 PR 能互相衔接。规则与 [`AGENTS.md`](../AGENTS.md) 冲突时，以 `AGENTS.md` 为准。

## 开始之前

- 环境：Node.js **22.18 或更高**（契约脚本直接加载 TypeScript，需要 Node 原生类型剥离）、pnpm **10.19.0**（运行 `corepack enable`）。
- 安装与启动：

  ```bash
  pnpm install
  pnpm dev
  ```

- 先读：`README.md`、`AGENTS.md`、`docs/architecture.md`、`docs/auth-and-api.md`、`docs/system-management.md`。

## 工作流程

1. **先讨论，再开 Issue。** 使用问题和还不成形的想法请发在 [Discussions](https://github.com/braver-braver/react-admin-starter/discussions)。新功能、行为变化和契约变更都必须先有 Issue 并达成一致；没有 Issue 的功能 PR 不会被接受。缺陷修复也请先开 Issue 写明复现步骤。
2. **开工前在 Issue 里写实施计划**：改哪些文件、如何验证。
3. **一个 PR 对应一个任务**，不夹带无关清理。从最新的 `main` 拉分支，例如 `feat/<任务>`、`fix/<问题>`。
4. **提交信息用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)**，例如 `feat(contract): add operation registry`。破坏性变更在类型后加 `!`，并在提交正文写 `BREAKING CHANGE:`。
5. **按 PR 模板填写描述**，包括任务编号、`Closes #<issue>`、对照过的 Mock 行为、行为变化清单和必跑命令结果。

## 契约变更

接口契约的唯一来源是 `src/contract/`（Zod schema 与操作注册表），`docs/api.openapi.json` 由它生成。

- 改契约后运行 `pnpm contract:generate` 并提交生成结果；CI 用 `pnpm contract:check` 检查二者一致。
- 同时更新 `docs/` 中的说明和 `CHANGELOG.md`；对接方可见的变化写进 CHANGELOG 的 **Migration notes**。
- `src/contract/` 只能依赖 `zod` 和同目录文件（带 `.ts` 后缀的相对路径），不得使用 `@/` 别名、`import.meta.env` 或 React，也不得出现演示账户等 Mock 专用字符串。
- 破坏性变更（删除、改名、改类型、收紧校验）必须在 PR 模板里勾选 Breaking Change。v1.0 之后，破坏性变更走新的 `/api/v2` 路径并升包的主版本。

## 必跑命令

| 命令 | 作用 | 何时必须通过 |
| --- | --- | --- |
| `pnpm lint` | ESLint：0 错误，不新增警告 | 每个 PR |
| `pnpm format:check` | Prettier | 每个 PR |
| `pnpm contract:check` | OpenAPI 文件与契约一致 | 每个 PR |
| `pnpm test` | Vitest 浏览器模式 | 每个 PR |
| `pnpm test:conformance` | 一致性套件的 Node 适配器自检 | 每个 PR |
| `pnpm build` | 构建、`tsc -b` 与生产产物检查（禁止 Mock 进入生产包） | 每个 PR |
| `pnpm knip` | 未使用的文件、导出与依赖（先 `pnpm build` 生成路由树） | 每个 PR |
| `pnpm test:e2e` | 桌面/手机 E2E 与可访问性基线 | 改动页面、路由、请求层或契约时 |
| `pnpm test:pages`、`pnpm test:demo` | Pages 快照组装与静态演示 | 改动 `scripts/`、`pages.yml` 或构建配置时 |

测试需要 Playwright Chromium：`pnpm test:browser:install`。

## 评审与合并

- **作者与评审者分离**：评审由作者以外的人或 agent 完成。
- **合并前读完全部评审**：包括 review 正文、行内评论和 PR 评论，以及推送新提交后新到的评论；逐条回复处理结果。有未处理的 P1/P2 意见时不合并。
- **合并只在维护者明确指令后进行**，使用 squash 合并。
- 遇到契约语义不清或需要新增行为变化时，先在 Issue 里提问，等维护者确认后再做。

## 不要做的事

- 不要创建 Tag 或 GitHub Release（发布由维护者执行），不要修改 Pages 设置或 `pages-snapshots` 分支。
- 不要在共享分支上 force push。
- 不要把 Mock、演示账户或会话标识带进普通生产构建（`scripts/check-production.mjs` 会检查）。
- 不要在本仓库实现生产后端，也不要为“以后可能用到”增加抽象或依赖。
- 不要删除或改写 `LICENSE` 与上游署名，不要提交密钥或真实用户数据。

## 上游署名

本项目最初改编自 [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin)（MIT 许可），来源与固定提交见 [`docs/upstream.md`](../docs/upstream.md)。

## 社区准则

请遵守[行为准则](./CODE_OF_CONDUCT.md)，就事论事、互相尊重。有疑问欢迎在 [Discussions](https://github.com/braver-braver/react-admin-starter/discussions) 提出。
