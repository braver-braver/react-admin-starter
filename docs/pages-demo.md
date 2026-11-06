# GitHub Pages 演示发布

本功能跟踪 Issue #14 和 #15。演示通过浏览器 MSW 提供模拟接口，不需要后端，不能用于真实认证或处理真实业务数据。

## 构建与本地验证

- `pnpm build`：普通生产构建，输出 `dist/`，禁止 Worker、处理器和演示凭据；真实认证由后端实现。
- `pnpm build:demo`：显式静态演示构建，输出 `dist-demo/`，启用 MSW、Hash 路由和带版本/提交号的演示提示。
- `pnpm test:pages`：验证版本目录保留、幂等发布、提交冲突拒绝及路径/软链接约束。
- `pnpm test:demo`：实际构建 latest 和 `v0.0.0-smoke`，组装到 `.demo-test/site/`，使用无 SPA fallback 的静态服务器运行桌面/手机 E2E。验证会话刷新、导航、退出以及同一浏览器下不同版本的权限和会话隔离。

需要先安装依赖和浏览器：`pnpm install --frozen-lockfile`、`pnpm test:browser:install`。演示测试占用 5192 端口，不复用已有服务。报告及 trace 保存在现有 Playwright 目录。

本地预览（示例使用项目 Pages 子路径）：

```sh
DEMO_BASE_PATH=/react-admin-starter/ DEMO_VERSION=latest pnpm build:demo
node scripts/assemble-pages.mjs dist-demo .pages-site .pages-upload
DEMO_SERVE_DIR=.pages-upload node scripts/serve-demo.mjs
```

访问 `http://127.0.0.1:5192/react-admin-starter/#/users`。`DEMO_BASE_PATH` 必须是以 `/` 开始并结束的目录路径，`DEMO_VERSION` 默认 `local`；要使用站点组装脚本，应明确指定 `latest` 或版本标签。提交号直接读取构建应用 checkout 的 Git HEAD，不接受手填替代。自定义域名当前需相应调整站点 base，默认工作流支持标准项目 Pages 和用户名 Pages 根路径。

演示账户与开发环境相同，密码均为 `Demo1234!`：管理员 `admin@example.com`、只读 `viewer@example.com`、受限 `guest@example.com`。不要输入真实密码或个人信息。模拟会话存在当前标签页的 sessionStorage，Cookie 名称/路径与存储键按演示路径隔离；API 和 Worker 也在该目录下。主题等外观偏好可以跨版本共享。

## 首次启用

1. 确保主分支包含完整应用 E2E 与独立的 Pages 演示发布工作流。
2. 在仓库 Settings → Pages → Build and deployment 选择 **GitHub Actions**。
3. 检查 `github-pages` environment 的部署规则：允许 main；若限制分支/标签，再允许发布标签 `v*`。GitHub Actions 必须允许 `contents: write` 创建专用的 `pages-snapshots` 分支，以及 `pages: write` / `id-token: write` 执行 Pages 部署。
4. 在 main 上运行 `Publish mock demo to GitHub Pages` 工作流，或由合并后的 main push 自动触发。工作流成功及浏览器在线验证之前，不应称站点“已上线”。

站点入口：

- 最新演示：`https://braver-braver.github.io/react-admin-starter/`
- 历史索引：`https://braver-braver.github.io/react-admin-starter/versions.html`
- 版本快照：`https://braver-braver.github.io/react-admin-starter/releases/<tag>/`，`<tag>` 是 Release 的 Tag，例如 [`releases/v1.0.0/`](https://braver-braver.github.io/react-admin-starter/releases/v1.0.0/)、[`releases/v1.0.0-rc.3/`](https://braver-braver.github.io/react-admin-starter/releases/v1.0.0-rc.3/)

界面路由在 `#/` 后，例如 `…/releases/<tag>/#/users`，因此刷新不依赖服务器路径重写。

## 上线后的真实站点验收

发布工作流在 Pages 部署成功后，自动执行 `pnpm test:live`：等待已发布 `demo.json` 中的版本号、Git 提交与目标路径匹配，随后直接通过公开 Pages URL 运行桌面和移动端 Playwright 验证，覆盖登录、刷新、权限差异、退出和接口是否由预期的 Service Worker 响应。此验证检查的是公开站点，不是本地临时服务器，也不会提高全局重试次数；部署 CDN 尚未传播时会进行有上限的轮询，而不是固定睡眠。

若部署成功但线上验收失败，Actions 会保持失败并上传浏览器 trace；此时网站可能已可访问，不能将整次发布标记为完全通过。为手动复现，设置 `LIVE_DEMO_SITE_URL` 为根站点 URL，设置 `LIVE_DEMO_VERSION` 为 `latest` 或发布标签，设置 `LIVE_DEMO_COMMIT` 为该版本对应的 40 位提交 SHA，然后运行 `pnpm test:live`。

首次真实验收记录（[#15](https://github.com/braver-braver/react-admin-starter/issues/15)）：

- [`v1.0.0`](https://github.com/braver-braver/react-admin-starter/releases/tag/v1.0.0) 的 [Release 运行](https://github.com/braver-braver/react-admin-starter/actions/runs/41798612436)：发布检查、构建、静态验证、快照、部署与 `test:live`（桌面、手机）全部通过。
- [`v1.0.0-rc.3`](https://github.com/braver-braver/react-admin-starter/releases/tag/v1.0.0-rc.3) 的 [Release 运行](https://github.com/braver-braver/react-admin-starter/actions/runs/41795226477) 与其[同一提交重跑](https://github.com/braver-braver/react-admin-starter/actions/runs/41795226477/attempts/2)：重跑不产生新快照提交，以同一构建版本部署，验证幂等。
- `v1.0.0-rc.1`、`v1.0.0-rc.2` 的 Release 运行因 [#91](https://github.com/braver-braver/react-admin-starter/issues/91) 未能部署，快照随后由 main 的部署上线；之后的 `latest` 与新版本发布都没有改动它们的文件。

## 自动发布与版本保存

main push 更新最新演示；发布 Release 则从事件对应的准确提交构建到 `releases/<tag>/`。支持 `vMAJOR.MINOR.PATCH` 和带 `-rc.1` 等后缀的预发布版本；旧版本必须本身包含 `build:demo` 和演示测试支持，否则构建会明确失败。不会给已有老 Release 伪造演示。

工作流先验证源码、普通生产边界和演示产物，再恢复 `pages-snapshots` 分支，组装整站，启动最终静态文件进行浏览器验证，通过后才保存快照、上传和部署 Pages。站点更新串行执行，不使用 force push。更新 latest 保留全部 Release 目录；Release 发布保留 latest 和其他版本。同一版本同一提交重跑会保留已有字节，不同提交试图覆盖同一标签会失败。版本索引由快照元数据生成，不手写。

`pages-snapshots` 是持久存储，不依赖有保留期限的 Actions artifact。该分支只存放生成的静态演示站点，不能作为源代码分支，也不能手工混入私人文件。上传目录会排除 Git 元数据。历史版本会占用仓库及 Pages 空间，保留策略见下一节；工作流不会自动删除任何历史版本。

## 快照保留策略

**默认全部保留。** 工作流从不删除版本目录，Release 和 Tag 也不删除。

当前体积（2026-11-06）：每个版本目录约 1.95 MB、53 个文件，整站约 9.7 MB，仓库约 12.5 MB。各版本相同的文件在 Git 里只存一份。GitHub Pages 的限制见[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)：发布站点不超过 1 GB，源仓库建议不超过 1 GB，单次部署 10 分钟超时，带宽软限制每月 100 GB；“每小时 10 次构建”的软限制不适用于本仓库使用的自定义 Actions 工作流。按现在的大小，还能容纳几百个版本。

查看体积：

```bash
git fetch origin pages-snapshots
git ls-tree -r -l origin/pages-snapshots | awk '{s += $4} END {printf "site: %.1f MB\n", s / 1e6}'
git ls-tree origin/pages-snapshots releases/ | wc -l   # 版本目录数
```

**何时评估：** 整站超过 500 MB（上限的一半）或版本目录超过 100 个时，由维护者决定是否下线一部分。

**可以下线什么：** 只有预发布版（`-rc.N`），并且对应的正式版已经发布。正式版的快照永远保留，因为使用者可能按版本锁定了演示链接。

**怎样下线（维护者手动操作，不改写历史）：**

1. 在 `pages-snapshots` 上提交删除，例如 `git rm -r releases/v1.0.0-rc.1`，提交信息写明 `Retire demo v1.0.0-rc.1` 和原因，普通 `git push`，不要 force push。
2. 在 Actions 里手动运行 `Publish mock demo to GitHub Pages`（选 `main`）。组装脚本会根据剩下的 `releases/*` 重新生成 `versions.json` 与 `versions.html`，被删除的版本从索引和站点上消失，其他版本的文件逐字节不变（`scripts/pages.test.mjs` 覆盖了这一点）。
3. **不要**再重跑这个版本的 Release 工作流，否则快照会被重新生成。
4. 在 CHANGELOG 里记一笔。Release 和 Tag 保留不动。

下线只缩小发布出去的站点。`pages-snapshots` 的 Git 历史仍然保留旧文件，仓库体积不会变小；要缩小仓库就得改写历史，这是禁止的。真到需要时，先开 Issue 讨论。

## 故障与恢复

- main、Release、手动触发共用发布并发组，设置 `queue: max` 按顺序排队（GitHub 最多支持 100 个等待任务），避免默认的单等待位取消较早的 Release。队列满时额外任务仍会被 GitHub 取消，需要手动重跑。参见 [GitHub 并发与队列说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。
- CI 在每个 PR 上验证普通应用 E2E、快照组装、两个静态版本和跨版本会话隔离；发布工作流只验证此次发布的真实目标版本，不要求伪造历史 Release。
- 静态浏览器验证失败会阻止保存和部署，并保留 7 天失败证据。
- 快照保存成功但 Pages 部署失败时，已上线站点保持上一版；修复 Pages 设置后重跑即可，快照保留且重跑幂等。
- Pages 以构建版本区分部署，并把构建版本当作本仓库的一个提交来解析：重复的构建版本沿用已有部署，不是提交的字符串（例如 `<sha>-<tag>`）返回 404。`actions/deploy-pages` 固定用 `GITHUB_SHA`，而 Release 的 Tag 指向 main 已经部署过的合并提交，所以工作流不用它，而是直接调用 Pages 部署 API，构建版本取“Persist verified site snapshots”刚推送的 `pages-snapshots` 提交：站点有变化时它一定是新提交，且其文件树就是上传的站点。见 [#91](https://github.com/braver-braver/react-admin-starter/issues/91)。
- 同一次运行重跑时，若快照没有变化，构建版本仍是上一次的快照提交，Pages 沿用内容相同的已有部署，结果幂等。部署按 artifact ID 进行，不受上一次尝试遗留的同名 `github-pages` artifact 影响。
- Pages environment 或仓库权限不足时，需要维护者调整上述设置。不要用个人令牌绕过环境保护。
- 删除 `pages-snapshots` 会失去后续发布时的历史输入，恢复应先恢复该分支的已知提交；不要删除后假定 Actions 的短期 artifact 能永久找回。
