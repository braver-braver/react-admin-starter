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

1. 合并 E2E 基础 PR #12，再合并演示发布 PR。
2. 在仓库 Settings → Pages → Build and deployment 选择 **GitHub Actions**。
3. 检查 `github-pages` environment 的部署规则：允许 main；若限制分支/标签，再允许发布标签 `v*`。GitHub Actions 必须允许 `contents: write` 创建专用的 `pages-snapshots` 分支，以及 `pages: write` / `id-token: write` 执行 Pages 部署。
4. 在 main 上运行 `Publish mock demo to GitHub Pages` 工作流，或由合并后的 main push 自动触发。工作流成功及浏览器在线验证之前，不应称站点“已上线”。

项目预期入口（启用并成功部署后才可用）：

- 最新演示：`https://braver-braver.github.io/react-admin-starter/`
- 历史索引：`https://braver-braver.github.io/react-admin-starter/versions.html`
- 版本快照：`https://braver-braver.github.io/react-admin-starter/releases/v0.2.0/`

界面路由在 `#/` 后，例如 `…/releases/v0.2.0/#/users`，因此刷新不依赖服务器路径重写。

## 自动发布与版本保存

main push 更新最新演示；发布 Release 则从事件对应的准确提交构建到 `releases/<tag>/`。支持 `vMAJOR.MINOR.PATCH` 和带 `-rc.1` 等后缀的预发布版本；旧版本必须本身包含 `build:demo` 和演示测试支持，否则构建会明确失败。不会给已有老 Release 伪造演示。

工作流先验证源码、普通生产边界和演示产物，再恢复 `pages-snapshots` 分支，组装整站，启动最终静态文件进行浏览器验证，通过后才保存快照、上传和部署 Pages。站点更新串行执行，不使用 force push。更新 latest 保留全部 Release 目录；Release 发布保留 latest 和其他版本。同一版本同一提交重跑会保留已有字节，不同提交试图覆盖同一标签会失败。版本索引由快照元数据生成，不手写。

`pages-snapshots` 是持久存储，不依赖有保留期限的 Actions artifact。该分支只存放生成的静态演示站点，不能作为源代码分支，也不能手工混入私人文件。上传目录会排除 Git 元数据。历史版本会占用仓库及 Pages 空间，版本数量增长后应另行制定保留策略，当前不会自动删除历史。

## 故障与恢复

- main、Release、手动触发共用发布并发组，避免两个发布覆盖历史。
- CI 在每个 PR 上验证普通应用 E2E、快照组装、两个静态版本和跨版本会话隔离；发布工作流只验证此次发布的真实目标版本，不要求伪造历史 Release。
- 静态浏览器验证失败会阻止保存和部署，并保留 7 天失败证据。
- 快照保存成功但 Pages 部署失败时，已上线站点保持上一版；修复 Pages 设置后重跑即可，快照保留且重跑幂等。
- Pages environment 或仓库权限不足时，需要维护者调整上述设置。不要用个人令牌绕过环境保护。
- 删除 `pages-snapshots` 会失去后续发布时的历史输入，恢复应先恢复该分支的已知提交；不要删除后假定 Actions 的短期 artifact 能永久找回。
