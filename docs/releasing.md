# 版本策略与发布流程

本仓库按 [SemVer](https://semver.org/lang/zh-CN/) 发布。agent 负责准备发布 PR（版本号与 CHANGELOG），维护者负责在 GitHub 创建 Release；Release 一经发布，[Pages 工作流](pages-demo.md) 会自动把该版本的演示构建到 `releases/<tag>/`，而且**不可覆写**。

## 版本规则

| 变更 | 版本 | 例子 |
| --- | --- | --- |
| 破坏性变更：删除或改名接口、路径、字段、错误码，改变类型、状态码或字段含义，可选字段变必填，收紧校验 | 主版本（MAJOR） | `1.4.2` → `2.0.0` |
| 向后兼容的新能力：新接口、新的可选请求字段、新的响应字段、新的错误码、放宽校验、新页面或新组件 | 次版本（MINOR） | `1.4.2` → `1.5.0` |
| 只修复缺陷、文档、内部重构，不改变对接方可见的行为 | 修订版本（PATCH） | `1.4.2` → `1.4.3` |

- **与 API 冻结规则一致**（见 [AGENTS.md](../AGENTS.md) 的 API compatibility）：v1.0.0 之后，`/api/v1` 只接受向后兼容的变更；破坏性变更走新的 `/api/v2` 前缀，同时升主版本，PR 标为 Breaking Change，并在 CHANGELOG 写 Migration notes。
- **v1.0.0 之前**也允许破坏性变更，但必须同样声明（PR 标 Breaking Change，CHANGELOG 写 Migration notes）。
- **预发布**：正式版之前先发 `-rc.N`，从 `-rc.1` 开始，例如 `1.0.0-rc.1`。rc 有问题时修复后发 `-rc.2`，**不要**删除或移动已有的 Tag。rc 验收通过后，再发去掉后缀的正式版。
- **Tag 格式**：`v` 加版本号，例如 `v1.0.0`、`v1.0.0-rc.1`。Pages 工作流只接受 `vMAJOR.MINOR.PATCH` 及可选的预发布后缀。

## 工具：commitizen 只管版本号，CHANGELOG 手写

版本号用 [commitizen](https://commitizen-tools.github.io/commitizen/) 修改。它是 Python 工具，不进 `package.json` 依赖，用 `pip install commitizen`（或 `pipx install commitizen`）安装。配置在 `cz.yaml`：`version_scheme: semver2` 得到 `1.0.0-rc.1` 这种编号；`update_changelog_on_bump: false` 关闭自动生成 CHANGELOG。

**CHANGELOG 不用 commitizen 生成。** 实测（见 [#46](https://github.com/braver-braver/react-admin-starter/issues/46)）：全量生成会把文件整体重写，丢掉手写的条目、Migration notes 和上游历史段落；增量生成在没有 Tag 时直接失败。所以 CHANGELOG 继续由人或 agent 手写，每个 PR 在 “Unreleased — React Admin Starter” 下补一条。

## 发布前检查清单

在发布 PR 的描述里逐项贴出结果：

| 检查 | 命令或方法 | 通过标准 |
| --- | --- | --- |
| CI 全部步骤 | `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm contract:check`、`pnpm format:check`、`pnpm test`、`pnpm test:conformance`、`pnpm build`、`pnpm knip`、`pnpm test:e2e`、`pnpm test:pages`、`pnpm test:demo` | 本地全部退出码为 0，PR 上的 CI 为绿 |
| 生产产物检查 | `pnpm build` 末尾的 `check-production.mjs` | 输出 `Production boundary verified`，产物里没有 Mock Worker、处理器或演示凭证 |
| 依赖安全 | `pnpm audit --prod` | 结果原样贴进 PR；有高危漏洞时先修复或说明不受影响的理由 |
| LICENSE 与上游署名 | `git log --oneline -- LICENSE`；`grep -n "satnaing/shadcn-admin" README.md` | LICENSE 自导入后没有改动；README 的署名段落仍在 |
| 上游固定提交 | `grep -n "Pinned commit" docs/upstream.md` | 仍是 `e16c87f213a5ba5e45964e9b67c792105ec74d26` |
| 版本号与 CHANGELOG | `pnpm release:check -- v1.0.0-rc.1 --skip-main` | 输出 `release:check v1.0.0-rc.1: ok`：Tag 格式正确、等于 `v` 加 `package.json` 的版本，CHANGELOG 有该版本的章节且位于上游历史段落之前。发布 PR 的提交还不在 `main` 上，所以这里跳过“属于 main”这一项 |

## 发布步骤

1. **准备发布 PR**（agent，在 `main` 的最新提交上新建分支）：
   ```bash
   # 正式版按变更类型选 MAJOR / MINOR / PATCH；预发布再加 --prerelease rc --prerelease-offset 1
   cz bump --yes --version-files-only --increment MAJOR --prerelease rc --prerelease-offset 1
   node -p "require('./package.json').version"   # 例如 1.0.0-rc.1
   ```
   `--version-files-only` 只改 `package.json`，不提交、不打 Tag（输出里的 “tag to create” 只是提示）。然后手工改 CHANGELOG：
   - 把 `## Unreleased — React Admin Starter` 改为 `## v1.0.0-rc.1 (YYYY-MM-DD)`，内容不动；
   - 在它上面新建一个空的 `## Unreleased — React Admin Starter`；
   - 更新文件开头的 **Release status** 说明；
   - “Historical upstream changelog” 及以下的上游段落**原样保留**。

   按清单跑完检查，开 PR。
2. **合并**：维护者审阅后合并发布 PR。
3. **创建 Release**（维护者）：Tag 必须指向**发布 PR 的合并提交**，不能写 `main`。合并之后 `main` 可能又进了别的提交，用分支名会把这些未列入 CHANGELOG 的改动带进不可覆写的 Release 和快照。先取出合并提交：
   ```bash
   # 84 换成发布 PR 的编号
   gh api repos/braver-braver/react-admin-starter/pulls/84 --jq .merge_commit_sha
   ```
   用这个提交再跑一次完整检查，这次包括“属于 main”：
   ```bash
   git fetch origin main
   pnpm release:check -- v1.0.0-rc.1 --commit <上一步得到的 40 位提交 SHA>
   ```
   命令行创建（推荐）：
   ```bash
   SHA=<上一步得到的 40 位提交 SHA>
   gh release create v1.0.0-rc.1 --target "$SHA" --title v1.0.0-rc.1 --notes-file notes.md --prerelease
   ```
   或在 GitHub 的 Releases 页面点 “Draft a new release”：
   - Tag 填 `v` 加版本号（例如 `v1.0.0-rc.1`）；
   - Target 不要选 `main`，在 “Recent commits” 里选上面那个合并提交，并核对 SHA；
   - 标题同 Tag，说明粘贴 CHANGELOG 中该版本的章节；
   - rc 勾选 “Set as a pre-release”；
   - 点 Publish。

   发布后核对 Tag 指向的提交：`git fetch --tags && git rev-parse v1.0.0-rc.1^{commit}`，结果应等于 `$SHA`。agent 不创建 Tag 或 Release。
4. **自动构建**：Release 发布后，Pages 工作流先对 Tag 对应的提交运行同一个 `release:check`（工作流步骤 “Check the release tag against the tagged code”），任何一项不通过就在构建之前终止，不会写入 `pages-snapshots`。通过后才构建演示，保存到 `pages-snapshots` 的 `releases/<tag>/`，同时保留 `latest` 和其他版本。

## 发布后验收

1. Actions 里本次的 “Publish mock demo to GitHub Pages” 运行成功。工作流部署后会自动运行 `pnpm test:live`，对公开站点做桌面和移动端验证。
2. 打开 `https://braver-braver.github.io/react-admin-starter/releases/<tag>/` 与 `latest`，两者都能访问；版本索引里出现新版本，旧版本仍在。
3. 需要手工复现线上验收时，对该版本运行：
   ```bash
   LIVE_DEMO_SITE_URL=https://braver-braver.github.io/react-admin-starter/ \
   LIVE_DEMO_VERSION=v1.0.0-rc.1 \
   LIVE_DEMO_COMMIT=<该版本的 40 位提交 SHA> \
   pnpm test:live
   ```
   Playwright 不读取 `HTTPS_PROXY`，在只能经代理访问外网的环境里，这一步会因为取不到 `demo.json` 而超时。这种情况下以工作流里的 “Smoke-test the deployed Pages URL in Chromium” 步骤为准：它运行的是同一份配置。

## 失败时怎么办

- **发布 PR 的检查失败**：在 PR 里修复，不要发布。
- **Release 已发布，但 Pages 工作流失败**：按 [GitHub Pages 演示发布 · 故障与恢复](pages-demo.md#故障与恢复) 处理。静态验证失败会阻止保存和部署；快照已保存但部署失败时，修复后重跑即可，重跑是幂等的。
- **版本本身有问题**（rc 或正式版）：**不要**删除 Tag、Release 或 `pages-snapshots` 里的快照，也不要用同一个 Tag 指向另一个提交（工作流会拒绝覆盖）。修复后发下一个版本：rc 发 `-rc.N+1`，正式版发下一个 PATCH，并在 CHANGELOG 里说明原因。
