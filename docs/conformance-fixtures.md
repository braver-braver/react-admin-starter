# 一致性套件：后端夹具清单

契约一致性套件（`src/contract/conformance/`）用同一组场景检查 Mock 和真实后端。本文列出后端在运行套件之前必须准备好的数据，以及如何用 `pnpm test:contract` 对真实后端运行。完整的接入步骤见后续的后端接入指南（M2-T8），它会引用本文。

## 运行前提

- **使用可丢弃的数据库。** 场景会创建、修改并删除数据。Tier 2 还会尝试停用内置管理员、删除内置角色，这些操作本应被拒绝；如果后端错误地接受了，这个库就需要重建。
- **完整实现系统管理 API。** Tier 2 不要求预置范围受限的账号，而是用 admin 通过 `createSystemDepartment`、`createSystemRole`、`createSystemAccount` 现场创建部门、角色和带初始密码的账号，然后登录这些账号检查规则。所以这些接口和账号登录必须先能工作。
- **场景按顺序执行，彼此独立。** 每个场景开始前都会丢弃会话（`forget()`），结束时以 admin 身份删除自己创建的数据并检查删除结果，所以套件可以在同一个库上重复运行。名称、编码和邮箱都带随机前缀（形如 `ct…`，邮箱域名 `example.test`），不会和已有数据冲突。

## 对真实后端运行：`pnpm test:contract`

`scripts/run-contract-tests.mjs` 基于 `node:test` 和全局 `fetch`，需要 Node 22.18 或更高版本。每个场景对应一个测试，按 Tier 1、Tier 2、派生的访问检查的顺序执行。后端项目可以在自己的 CI 里检出本仓库后运行它；本仓库的 CI 不运行它（因为需要真实后端），只用替身服务器检查它本身（`pnpm test:conformance`）。

```bash
CONTRACT_BASE_URL=http://localhost:8000 \
CONTRACT_ADMIN_EMAIL=admin@example.com CONTRACT_ADMIN_PASSWORD=… \
CONTRACT_VIEWER_EMAIL=viewer@example.com CONTRACT_VIEWER_PASSWORD=… \
CONTRACT_GUEST_EMAIL=guest@example.com CONTRACT_GUEST_PASSWORD=… \
CONTRACT_TIER2=1 \
pnpm test:contract -- --json contract-report.json
```

| 配置 | 说明 |
| --- | --- |
| `CONTRACT_BASE_URL` 或 `--base-url` | 后端的源地址，**不带** `/api/v1`（客户端会自动加上；带了会报错退出） |
| `CONTRACT_ADMIN_EMAIL` / `_PASSWORD` | 夹具 `admin`，要求见下文 |
| `CONTRACT_VIEWER_EMAIL` / `_PASSWORD` | 夹具 `viewer` |
| `CONTRACT_GUEST_EMAIL` / `_PASSWORD` | 夹具 `guest` |
| `CONTRACT_TIER2=1` | 确认数据库可以丢弃，并启用 Tier 2。不设置时 Tier 2 被跳过，终端会打印“跳过 Tier 2” |
| `--tier 1` | 只选 Tier 1 和派生检查；此时 Tier 2 算作“未选择”，不算跳过 |
| `--grep <正则>` | 只跑名称匹配的场景，便于定位单个失败 |
| `--json <文件>` | 另外写一份 JSON 报告：按组汇总的通过/失败/跳过数，以及每个场景的状态、耗时和失败原因 |
| `--timeout <毫秒>` | 单个场景的超时，默认 60000。超时的场景记为失败，其进行中的请求会被取消，下一个场景要等它停下来才开始，所以场景之间不会交叠 |

结束时终端会打印按组的汇总和每个失败场景的原因。退出码如下：

- `0`：选中的场景全部执行并通过；
- `1`：至少一个场景失败；
- `2`：配置有误，什么都没执行；
- `3`：没有失败，但 Tier 2 被跳过。**跳过不算通过**，CI 里请把非 0 当作失败，或者明确用 `--tier 1`。

## 必须预置的三个账号

运行器把它们作为 `Fixtures` 传入。Mock 的参考数据见 `src/mocks/data/system.ts`，三个账号的密码都是 `Demo1234!`。

| 夹具 | 要求 | Mock 参考 |
| --- | --- | --- |
| `admin` | 内置恢复账号：`protected: true`，拥有全部权限，每项权限的数据范围都是全部（`scope: all`），能访问全部菜单。所在部门启用。 | `admin@example.com`，角色 `admin`（受保护），部门 `root` |
| `viewer` | 只有 `users:read` 与 `permissions:read`，范围为全部；**没有**任何写权限，也没有 `audit:read`。 | `viewer@example.com`，角色 `viewer`，部门 `operations` |
| `guest` | 没有任何权限（只能进入工作台），数据范围为本人。 | `guest@example.com`，角色 `guest`，部门 `operations` |

`login` 时邮箱不区分大小写；`admin` 的账号记录要能用邮箱在 `listSystemAccounts` 的 `search` 中查到。

## 系统数据的要求

| 数据 | 要求 | 用到它的场景 |
| --- | --- | --- |
| 部门 | 至少一个已启用的顶级部门（`parentId` 为空）。Tier 2 创建的部门都挂在它下面。 | 所有 Tier 2 场景 |
| 受保护记录 | 至少一个 `protected: true` 的角色（内置管理员角色）。若有受保护的部门，也会尝试删除它，并期望得到 409。 | 内置管理员与恢复入口受保护 |
| 权限记录 | 每个权限代码都有一条权限记录，`code` 等于下列代码：`users:read`、`users:write`、`permissions:read`、`audit:read`，以及五类系统资源各自的 `system:<resource>:read`、`system:<resource>:write`。场景按 `code` 查出记录 `id` 再写入角色，所以 `id` 可以和代码不同。 | 所有创建角色的场景 |
| 菜单 | 用户管理页面有一条菜单：`kind: page`，`routeId: users`。一个场景会临时把它设为隐藏，结束后恢复原值。 | 隐藏导航不撤销 API 权限；导航不授予 API 权限 |
| 业务用户 | 不需要预置。场景通过 `createUser` 创建，结束后用 `batchDeleteUsers` 删除。 | Tier 1 用户场景；Tier 2 范围场景 |

## 场景会现场创建的数据

便于后端实现者对照日志排查。所有数据都在场景结束时删除，顺序是业务用户 → 账号 → 角色 → 部门（子部门先于父部门）。

| 规则（AGENTS.md） | 现场创建 | 期望 |
| --- | --- | --- |
| 读全部 + 写本人不合并成写全部 | 部门 1 个；角色 `users:read`/all 与 `users:write`/self；账号 1 个；业务用户 2 个（admin 建 1 个，该账号建 1 个） | 能列出两个用户；改 admin 建的用户 → 403 `DATA_SCOPE_DENIED`；改自己建的 → 200 |
| 先过滤再计数和分页 | 部门 2 个；角色 `users:read`/custom（部门 A）；账号 1 个；业务用户 5 个（A 里 2 个） | `meta.total` = 2，`pageSize` = 1 时 `totalPageCount` = 2，两页恰好是 A 里的两个用户 |
| 混合范围的批量写入整批拒绝 | 部门 2 个；角色 `users:read`+`users:write`/custom（部门 A）；账号 1 个；业务用户 2 个（A 内外各 1） | `batchDeleteUsers`、`updateUsersStatus` 含范围外用户 → 403 `DATA_SCOPE_DENIED`，两个用户都没被删、状态没变；只含范围内用户 → 成功 |
| 隐藏导航不撤销 API 权限 | 无（临时隐藏 `users` 菜单） | viewer 的 `getNavigation` 不把它当作可见菜单，`listUsers` 仍为 200 |
| 导航不授予 API 权限 | 部门 1 个；角色（无权限，菜单含 `users`）；账号 1 个 | `getNavigation` 不含 `users` 页面；`listUsers` → 403 `FORBIDDEN` |
| 内置管理员与恢复入口受保护 | 无 | 停用 admin 账号、删除受保护角色（及受保护部门）→ 409 `SYSTEM_RULE` |
| 引用无环 | 部门 2 个（父子） | 父部门改挂到自身或子部门下 → 422 `SYSTEM_RULE` |
| 凭证不进入账号 DTO 和审计 | 部门 1 个；角色 1 个；账号 1 个（随后改密码） | 创建、更新、列表、登录响应和审计日志里没有明文密码，也没有名称含 password/hash/salt/secret/credential 的字段 |
| 停用再启用后旧会话仍失效 | 部门 1 个；角色 1 个；账号 1 个 | 停用期间登录 → 401 `INVALID_CREDENTIALS`；重新启用后，停用前的会话 Cookie 访问 `getSession` → 401（需要能回放 Cookie 的客户端，见下文）；可以重新登录 |
| 角色编辑不能委派超出自身的能力、范围和页面（含已分配的账号） | 部门 2 个（本部门、另一部门）；编辑者角色 `system:roles:read`+`system:roles:write`/all 与 `users:read`/custom（本部门）；目标角色 `users:read`/custom（本部门），分配给另一部门的 1 个账号；编辑者账号 1 个 | 新建或修改角色时加入 `users:write`、改成 all 范围、加入 `users` 菜单 → 403 `SYSTEM_RULE`；把目标角色改成 department 范围（编辑者自己不越界，但让另一部门的账号获得该部门范围）→ 403；以上修改都不生效；只改名 → 200；新建范围内的角色 → 201 |
| 账号分配不能委派超出自身的数据范围 | 部门 1 个；管理者角色 `system:accounts:*`+`users:read`/custom（本部门）；`users:read` 的 all 与 custom 角色各 1 个；账号 1 个 | 给新账号分配 all 范围的角色 → 403 `SYSTEM_RULE`；分配 custom 范围的 → 201 |
| 本人范围的账号不能改部门 | 部门 2 个；角色 `system:accounts:*`/self；账号 1 个 | 把自己改到另一个部门 → 403 `SYSTEM_RULE`；同部门改名 → 200 |
| 系统引用选项跟随资源读授权 | 部门 2 个；角色 `system:departments:read`/custom（部门 A）与 `system:roles:read`/all；账号 2 个 | 前者的 `getSystemOptions` 只有部门，含 A、不含 B；后者只有角色 |
| 部门改父级或启用需按编辑者改动前的授权校验：数据范围 | 部门 3 个（分支 A、同级 B、A 下停用的 C）；角色 `audit:read`/descendants 与 `system:departments:*`/all；账号 2 个（都在 A） | 编辑者（没有 `audit:read`）把 B 挂到 A 下、或启用 C → 403 `SYSTEM_RULE`；admin 把 B 挂到 A 下 → 200 |
| 部门改父级或启用需按编辑者改动前的授权校验：重新生效账号的能力和页面 | 部门 4 个（办公室、停用的父部门及其子部门、另一个停用部门）；角色 `users:write`/self、`users:read`/self（含 `users` 菜单）、编辑者 `system:departments:*`+`users:read`/all；账号 3 个 | 部门停用后其中的账号失效。编辑者（没有 `users:write`，也没有 `users` 菜单）把子部门移出停用的父部门、启用父部门、启用另一个部门，都会让账号重新获得编辑者没有的能力或页面 → 403 `SYSTEM_RULE`；admin 启用 → 200 |

## 会话 Cookie 回放

“退出后旧 Cookie 失效”（Tier 1）和“停用再启用后旧会话仍失效”（Tier 2）需要把之前保存的会话 Cookie 放回去再请求。

- **Node 适配器**（`createNodeClient`，`pnpm test:contract` 使用的就是它）自己管理 Cookie，总是执行回放检查。
- **浏览器适配器**（`createBrowserClient`）面对真实后端时读不到 HttpOnly Cookie，不传 `sessionCookies`，场景会跳过回放，只检查其余部分。
- **Mock 测试**（`src/mocks/conformance.test.ts`）的会话 Cookie 不是 HttpOnly，测试通过 `sessionCookies` 钩子做回放，所以 Mock 上这两条也完整检查。
