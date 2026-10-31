## 说明

<!-- 这个 PR 做了什么、为什么。一个 PR 只对应一个任务。 -->

- 任务编号：<!-- 例如 M1-T5；没有则写“无” -->
- 关联 Issue：Closes #

## 变更类型

- [ ] 缺陷修复
- [ ] 新功能
- [ ] 重构（不改变行为）
- [ ] 契约变更（`src/contract/` 有改动，已运行 `pnpm contract:generate`）
- [ ] **Breaking Change**（对现有行为或公共 API 不兼容，已写入 CHANGELOG 的 Migration notes）
- [ ] 文档
- [ ] 其他：

## 对照过的 Mock 行为

<!-- 改动涉及接口时，写明对照了哪些 Mock 行为；没有写“无”。 -->

## 行为变化清单

<!-- 逐条列出对用户或对接方可见的行为变化；没有写“无”。 -->

## 必跑命令

- [ ] `pnpm lint`（0 错误，不新增警告）
- [ ] `pnpm format:check`
- [ ] `pnpm contract:check`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm knip`
- [ ] 按需：`pnpm test:e2e`（页面、路由、请求层、契约）、`pnpm test:pages` / `pnpm test:demo`（`scripts/`、`pages.yml`、构建配置）

<!-- 在这里贴结果摘要，例如用例数、是否全绿。 -->

## 确认

- [ ] 提交信息符合 Conventional Commits，破坏性变更带 `!`
- [ ] 改了契约或行为时，已同步更新 `docs/` 与 `CHANGELOG.md`
- [ ] 已读过[贡献指南](./CONTRIBUTING.md)
