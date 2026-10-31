# 后端接入指南

本指南面向要为 React Admin Starter 实现后端的开发者。它只描述协议和检查清单，与语言和框架无关，不需要阅读前端源码。

接口的权威定义是 [OpenAPI 文档](api.openapi.json)，由 `src/contract/` 的 Zod 契约生成，其中每个操作的路径、方法、请求体、成功响应和可能返回的错误码都按状态码列出。本指南解释 OpenAPI 表达不了的部分：会话、检查顺序、授权语义、部署方式，以及怎样用一致性套件验收。另见 [API、会话与权限](auth-and-api.md)（操作总表）、[系统管理与统一授权](system-management.md)（授权模型细节）和 [一致性套件夹具清单](conformance-fixtures.md)。

> 仓库里的 Mock（MSW）和一致性套件的替身服务器（`src/contract/conformance/stand-in.node.ts`）都**不是**参考后端实现，只用于演示和测试，请不要照着它们写后端。

## 1. 最小可用实现顺序

先让 Tier 1 全部通过，再做系统管理和 Tier 2。每一步都可以用 `pnpm test:contract --tier 1 --grep <场景名>` 单独验收（见第 11 节）。

1. **路由与通用访问检查**（第 3 节）：所有接口都在 `/api/v1` 下。对每个请求，依次检查来源标识、会话、能力和 CSRF。派生的访问检查场景（名称以 `generic:` 开头）只验证这一层，即使业务逻辑还没写也能通过。
2. **认证**：`login`、`getSession`、`logout`（第 2 节），以及 `getPermissions`、`getNavigation`。
3. **业务用户**：`listUsers`、`createUser`、`updateUser`、`deleteUser`、`batchDeleteUsers`、`updateUsersStatus`（第 6 节），以及 `inviteUser`、`inviteUsersBatch`。
4. **上传**：`uploadFile`（第 7 节）。**审计**：`listAuditLogs`，并给写操作留痕（第 8 节）。到这一步，`pnpm test:contract --tier 1` 应该全部通过。
5. **系统管理**：账号、角色、权限、菜单、部门的增删改查和 `getSystemOptions`，同时按第 5 节实现数据范围、委派上限和保护规则。然后在可丢弃的数据库上设置 `CONTRACT_TIER2=1`，跑通 Tier 2。
6. **同源部署**（第 9 节）。

## 2. Cookie 会话

前端只依赖同源 Cookie 会话，不使用 Bearer 令牌，也不读取 Cookie 内容。

| 项目 | 要求 |
| --- | --- |
| Cookie 属性 | `HttpOnly; Secure; SameSite=Lax`。名称自定。`Path` 至少覆盖 `/api/`，通常用 `/`。本地 http 调试可以不加 `Secure`，生产必须加。 |
| 内容 | 不透明的随机会话 ID（至少 128 位），会话数据保存在服务端。不要把角色、权限或部门放进 Cookie 让前端信任。 |
| 过期 | 设置合理的 `Max-Age` 或 `Expires`，服务端同时记录过期时间。过期或未知的会话一律视为未登录。 |
| 登录 | 成功时**签发新的会话 ID**（会话轮换）；请求若带着旧会话，作废旧会话。失败时**不得**设置任何会话 Cookie，返回 401 `INVALID_CREDENTIALS`。邮箱比较不区分大小写。 |
| 退出 | `logout` 需要 CSRF。必须**在服务端吊销**会话，并用 `Max-Age=0` 清除 Cookie。之后即使有人把旧 Cookie 原样带回来，`getSession` 也必须返回 401（Tier 1 会这样回放检查）。 |
| 吊销 | 停用账号、删除账号、重置密码时，该账号的所有现有会话立即失效。**停用后再启用，也不能恢复旧会话**（Tier 2）。 |
| 权限时效 | `getSession` 和每个接口都按服务端当前的账号、角色和部门重新计算权限，不能信任会话创建时缓存的权限。 |
| 响应头 | 接口响应建议加 `Cache-Control: no-store`。 |

`login` 和 `getSession` 返回同一种 Session：

```json
{
  "data": {
    "user": {
      "id": "account-1",
      "email": "admin@example.com",
      "name": "管理员",
      "roles": ["admin"],
      "permissions": ["users:read", "users:write"],
      "routes": ["/users"],
      "departmentId": "dept-root",
      "dataScopes": {
        "users:read": { "all": true, "self": false, "departments": [] }
      }
    },
    "csrfToken": "随机且非空"
  }
}
```

`id`、`email`、`name`、`roles`、`permissions` 和 `csrfToken` 必填。`routes`、`departmentId`、`dataScopes` 在契约中是可选字段，但前端靠 `routes` 判断能打开哪些页面：缺少 `routes` 时，账号只能进入工作台（第 5 节）。

## 3. 请求检查顺序：来源标识、会话、能力、CSRF

每个请求都按以下顺序检查，**遇到第一个失败就返回**，不再读取请求体：

| 顺序 | 条件 | 失败时返回 |
| --- | --- | --- |
| 1 | 写请求（POST、PUT、PATCH、DELETE）必须带 `X-Requested-With: ReactAdminStarter`。它先于会话检查：没登录的写请求如果缺这个头，也返回 403 而不是 401。 | 403 `REQUEST_HEADER_REQUIRED` |
| 2 | 需要会话的操作（除 `login` 外都需要）必须有有效会话。 | 401 `UNAUTHENTICATED` |
| 3 | 声明了能力的操作，会话必须持有该能力；`getSystemOptions` 只需持有任意一个 `system:*:read`。 | 403 `FORBIDDEN` |
| 4 | 已登录的写请求必须带 `X-CSRF-Token`，且值等于会话的 `csrfToken`。 | 403 `INVALID_CSRF_TOKEN` |

各操作需要哪种能力、是否需要 CSRF，见 OpenAPI 中每个操作的 `description`、`security` 和参数；汇总表见 [API、会话与权限](auth-and-api.md)。

**Origin 校验**：生产环境下，写请求若带了 `Origin`（或在没有 `Origin` 时带了 `Referer`），其源必须等于站点自身的源，否则拒绝。契约没有为此单独设错误码，建议按第 1 步处理，返回 403 `REQUEST_HEADER_REQUIRED`。不要开放带凭证的跨域访问（`Access-Control-Allow-Credentials` 搭配任意源）。

## 4. 响应与错误

- **成功**：HTTP 200（创建类为 201，以 OpenAPI 为准），响应体为 `{ "data": … }`。缺少 `data` 信封，前端会把它当作格式错误。
- **失败**：使用正确的 HTTP 状态码，响应体为 `{ "error": { "code": "…", "message": "…" } }`。`code` 必须是下表中、且该操作在该状态码下声明过的错误码。`message` 直接展示给用户（默认中文），不能包含凭证、SQL 或堆栈。不要用 HTTP 200 返回失败。
- **时间戳**：`createdAt`、`updatedAt` 等字段是 ISO 8601 date-time 字符串，必须带时区，例如 `2026-10-30T10:00:00Z`。
- **兼容性**：响应对象可以带契约之外的字段，前端会忽略。系统管理的请求体不接受未知字段，遇到时返回 422 `INVALID_FIELDS`。
- **未匹配的路径**：返回 404 `NOT_FOUND`；方法与路径不匹配时返回 400 `INVALID_METHOD`。

错误码表（每个操作的可用子集见 OpenAPI 中各状态码的响应，以及 `components.schemas.ErrorCode`）：

<!-- error-codes:start -->
| 错误码 | 状态码 | 含义 |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | 没有有效会话：缺失、过期、已吊销或未知的 Cookie |
| `INVALID_CREDENTIALS` | 401 | 登录失败：邮箱不存在或密码错误 |
| `INVALID_REQUEST` | 400 | 请求体不是合法 JSON |
| `INVALID_CREDENTIALS_FORMAT` | 400 | 登录请求体不含有效的邮箱和密码 |
| `REQUEST_HEADER_REQUIRED` | 403 | 缺少 `X-Requested-With: ReactAdminStarter` |
| `INVALID_CSRF_TOKEN` | 403 | 已登录的写请求缺少或带错了 `X-CSRF-Token` |
| `FORBIDDEN` | 403 | 会话缺少该操作要求的能力 |
| `DATA_SCOPE_DENIED` | 403 | 记录（或批量中的某条记录）超出操作者的数据范围；批量整批拒绝 |
| `USER_NOT_FOUND` | 404 | 没有该 id 的业务用户 |
| `INVALID_USER_FIELDS` | 422 | 业务用户的必填字段为空，或邮箱、角色不合法 |
| `DUPLICATE_USER` | 422 | 邮箱或用户名已存在 |
| `INVALID_STATUS` | 422 | 批量状态只能是 `active` 或 `inactive` |
| `INVALID_EMAIL` | 422 | 邀请邮箱格式不合法 |
| `INVALID_ROLE` | 422 | 角色不在允许的取值内 |
| `FILE_REQUIRED` | 422 | 上传请求没有 `file` 部分 |
| `UNSUPPORTED_FILE_TYPE` | 422 | 只接受图片 |
| `FILE_TOO_LARGE` | 422 | 上传超过 2 MB |
| `INVALID_FIELDS` | 422 | 系统管理请求体未通过校验 |
| `SYSTEM_RULE` | 401/403/404/409/422 | 系统管理的业务规则拒绝了这次修改：会话已变化（401）、委派或范围限制（403）、记录不存在（404）、受保护、重复或仍被引用（409）、引用或层级不合法（422） |
| `NOT_FOUND` | 404 | 未知的路径或系统资源（路由层） |
| `INVALID_METHOD` | 400 | HTTP 方法与资源路径不匹配（路由层） |
<!-- error-codes:end -->

## 5. 授权模型

### 能力码

权限是普通字符串，前端不做通配，未知能力一律视为没有：

<!-- capabilities:start -->
| 能力码 | 用途 |
| --- | --- |
| `users:read` | 查看业务用户 |
| `users:write` | 维护业务用户（增删改、批量、邀请）和上传 |
| `permissions:read` | 查看自己的角色与权限（`getPermissions`） |
| `audit:read` | 查询审计日志 |
| `system:accounts:read` | 查看登录账号 |
| `system:accounts:write` | 维护登录账号 |
| `system:roles:read` | 查看角色 |
| `system:roles:write` | 维护角色 |
| `system:permissions:read` | 查看权限目录 |
| `system:permissions:write` | 维护权限目录 |
| `system:menus:read` | 查看菜单 |
| `system:menus:write` | 维护菜单 |
| `system:departments:read` | 查看部门 |
| `system:departments:write` | 维护部门 |
<!-- capabilities:end -->

角色名称本身不代表任何能力。“管理员”也必须在 `permissions` 里逐项列出它拥有的能力。

### 数据范围

账号属于一个部门，可以有多个启用的角色；每个角色有能力、菜单和一种数据范围：

| 模式 | 含义 |
| --- | --- |
| `all` | 全部数据 |
| `department` | 账号所属部门 |
| `descendants` | 账号所属部门及其所有下级部门 |
| `self` | 本人：业务记录的 `createdBy` 等于当前账号；对账号记录，指账号本身 |
| `custom` | 角色指定的部门，不自动包含下级 |

- **按能力分别计算**：某项能力的数据范围，只在授予了这项能力的角色之间取并集。“`users:read` 全部”加上“`users:write` 本人”，不会变成“写全部”。Session 的 `dataScopes` 按能力码给出 `{ all, self, departments }`。
- **先过滤，再计数和分页**：列表的 `meta.total` 只统计范围内的记录。
- **批量原子拒绝**：批量操作只要包含一条范围外记录，整批返回 403 `DATA_SCOPE_DENIED`，一条都不修改。
- **写入时检查两端**：既检查原记录，也检查目标部门，不能通过改部门把记录移出范围，也不能在范围外创建记录。
- 系统配置的写入（角色、权限、菜单、部门）要求该写能力的范围是 `all`。账号管理可以按部门隔离。
- **不能越权委派**：创建或修改角色、给账号分配角色时，不能授出操作者自己没有的能力、比自己更大的数据范围、自己打不开的页面；修改角色时还要检查所有已分配该角色的账号。本人范围的账号不能修改自己的部门。部门改父级或启用，会间接扩大下级部门相关账号的权限，必须按编辑者改动前的授权检查新增的能力、范围和页面。
- **保护记录**：内置恢复管理员账号、超级管理员角色、根部门，以及工作台和菜单管理这两个恢复入口菜单，都不能停用、删除或改动（409 `SYSTEM_RULE`）；权限目录里的内置项可以改名称和说明，但不能改代码。部门不能成环（422）。账号响应和审计里都不能出现密码、摘要或凭证版本。

更完整的规则见 [系统管理与统一授权](system-management.md)。Tier 2 为每条规则准备了至少一个场景（见第 11 节）。

### `routes` 白名单与导航

前端只能打开已注册的页面，服务端用 `user.routes` 告诉它这个账号能打开哪些。`routes` 写页面**路径**；导航（`getNavigation`）里的菜单用页面 **id**（`routeId`）引用页面：

<!-- routes:start -->
| 页面 id（`routeId`） | 路径（写进 `routes`） | 需要的能力 |
| --- | --- | --- |
| `dashboard` | `/` | 无，所有已登录账号都能进入 |
| `users` | `/users` | `users:read` |
| `current-permissions` | `/permissions` | `permissions:read` |
| `audit` | `/audit` | `audit:read` |
| `system-accounts` | `/system/accounts` | `system:accounts:read` |
| `system-roles` | `/system/roles` | `system:roles:read` |
| `system-permissions` | `/system/permissions` | `system:permissions:read` |
| `system-menus` | `/system/menus` | `system:menus:read` |
| `system-departments` | `/system/departments` | `system:departments:read` |
<!-- routes:end -->

- 账号对某个页面要同时满足三点：页面菜单启用（父目录也启用）、角色授予了该菜单（或其所在目录）、持有该页面需要的能力。满足时，把路径写进 `routes`。
- `getNavigation` 返回同样满足条件、且**可见**的菜单记录（目录加页面，字段见 OpenAPI 的 `SystemMenu`）。
- 菜单“隐藏”只影响导航，不撤销页面和接口；“停用”才会撤销页面。菜单从来不会授予或撤销**接口**权限，接口始终按能力和数据范围独立检查（Tier 2 会验证）。

## 6. 分页、筛选与排序

所有分页列表（业务用户、审计日志、五种系统资源）都用同一种信封：

```json
{ "data": { "items": [], "meta": { "page": 1, "pageSize": 10, "total": 0, "totalPageCount": 1 } } }
```

- `page` 从 1 开始；`pageSize` 默认 10，超过 100 时按 100 处理，**不报错**；`totalPageCount` 至少为 1；`meta` 要原样回显实际使用的 `page` 和 `pageSize`。
- 多值参数使用**重复键**，例如 `status=active&status=inactive`，键名不带 `[]`。
- `listUsers` 的参数：
  - `username`：在用户名、邮箱、姓名、电话中模糊匹配，不区分大小写；
  - `status`、`role`：多值筛选；
  - `sortBy`：取值为 `username`、`fullName`、`email`、`phoneNumber`、`status`、`role`、`createdAt`、`updatedAt`，其他值**回退到 `username`**，不报错；
  - `sortOrder`：`asc` 或 `desc`。
- 系统资源列表的参数是 `search`：匹配名称，以及编码或邮箱。
- 筛选、排序、分页都在服务端完成，并且在数据范围过滤**之后**进行。

业务用户的取值：
- `status` 为 `active`、`inactive`、`invited`、`suspended`；
- `role` 为 `superadmin`、`admin`、`manager`、`cashier`。

新建的用户状态为 `active`，邀请的用户状态为 `invited`。创建和更新都需要 `firstName`、`lastName`、`username`、`email`、`phoneNumber`、`role`，缺失或为空时返回 422 `INVALID_USER_FIELDS`；邮箱或用户名与**其他**用户重复时返回 422 `DUPLICATE_USER`。未知 id 返回 404 `USER_NOT_FOUND`。`password` 可选，**不能**出现在任何响应里。`updateUsersStatus` 只接受 `active` 或 `inactive`。

## 7. 上传

- `POST /api/v1/uploads`，`multipart/form-data`，文件放在 `file` 字段；需要 `users:write` 和 CSRF。
- 没有 `file` 部分时返回 422 `FILE_REQUIRED`。
- 只接受图片，否则返回 422 `UNSUPPORTED_FILE_TYPE`。请检查**文件内容**（例如 PNG、JPEG 的文件头），不要只看客户端声明的 MIME 类型。一致性套件发送的是能正常解码的 1×1 PNG。
- 超过 2 MB（2 × 1024 × 1024 字节）返回 422 `FILE_TOO_LARGE`。
- 成功返回 `{ id, name, url, contentType, size }`，其中 `url` 应是可以持久访问的下载地址。

## 8. 审计

`listAuditLogs` 需要 `audit:read`，按 `createdAt` **最新在前**排序，支持重复键的 `action` 筛选。

条目字段为 `{ id, createdAt, actorName, actorEmail, action, target, detail, ip }`。`action` 的取值：

| action | 何时记录 |
| --- | --- |
| `auth.sign_in` / `auth.sign_out` | 登录成功、退出 |
| `user.created` / `user.updated` / `user.deleted` | 业务用户的单条写入 |
| `user.batch_deleted` / `user.status_changed` | 批量删除、批量改状态 |
| `user.invited` / `user.batch_invited` | 邀请 |
| `system.changed` | 任何系统管理写入 |

`actorEmail` 是执行操作的登录账号的邮箱。`target` 要能让人认出对象：创建业务用户时至少包含其用户名或邮箱（Tier 1 会检查）。审计里不能出现密码、摘要或 CSRF 令牌。

## 9. 同源部署

前端始终请求同源的 `/api/v1/...`，所以部署时要满足两点：

1. 反向代理先把 `/api/` 前缀的请求转给后端。按前缀转发，将来的 `/api/v2` 也会自动覆盖。
2. 其他路径交给前端静态文件；文件不存在时**回退到 `index.html`**，否则刷新深层链接会 404。

nginx 示例（只是配置示例，按实际环境调整证书、端口和路径）：

```nginx
server {
  listen 443 ssl;
  server_name admin.example.com;
  root /srv/react-admin-starter/dist;

  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

后端放在代理后面时，按 `X-Forwarded-Proto` 判断是否为 https，以确保 Cookie 带上 `Secure`；Origin 校验要用对外的源（`https://admin.example.com`）。

本地联调时，用 Vite 代理代替 nginx：把 `VITE_API_PROXY_TARGET` 设为后端的源地址（只写源，不带路径），开发服务器和生产预览都会把 `/api` 转发过去。

```bash
# 关闭 Mock，开发服务器对接本地后端
VITE_ENABLE_MOCKS=false VITE_API_PROXY_TARGET=http://127.0.0.1:8000 pnpm dev

# 用普通生产构建对接本地后端
pnpm build
VITE_API_PROXY_TARGET=http://127.0.0.1:8000 pnpm preview --port 4173
```

## 10. 夹具清单

运行一致性套件前，后端要准备好三个账号：admin（受保护的内置恢复账号，拥有全部能力、全部范围）、viewer（只有 `users:read` 和 `permissions:read`）、guest（没有任何能力）。还需要一个启用的顶级部门、受保护的管理员角色、每个能力码各一条权限记录，以及一条 `routeId: users` 的页面菜单。完整要求和每个场景会现场创建的数据，见 [一致性套件夹具清单](conformance-fixtures.md)。

## 11. 用 `pnpm test:contract` 验收

在本仓库目录下（Node 22.18 或更高版本，执行过 `pnpm install`）运行：

```bash
export CONTRACT_BASE_URL=http://127.0.0.1:8000   # 后端的源地址，不带 /api/v1
export CONTRACT_ADMIN_EMAIL=admin@example.com CONTRACT_ADMIN_PASSWORD='…'
export CONTRACT_VIEWER_EMAIL=viewer@example.com CONTRACT_VIEWER_PASSWORD='…'
export CONTRACT_GUEST_EMAIL=guest@example.com CONTRACT_GUEST_PASSWORD='…'

pnpm test:contract -- --tier 1                        # 先只跑 Tier 1
pnpm test:contract -- --tier 1 --grep '^logout: '     # 只跑名称匹配的场景
CONTRACT_TIER2=1 pnpm test:contract -- --json contract-report.json   # 可丢弃的库：Tier 1 + Tier 2
pnpm test:contract -- --help                          # 全部选项与退出码
```

退出码：
- `0`：选中的场景全部通过；
- `1`：有场景失败；
- `2`：配置错误；
- `3`：Tier 2 被跳过（跳过不算通过）。

在 CI 里请把任何非 0 都当作失败，或者明确使用 `--tier 1`。每个场景名都以契约操作编号（如 `listUsers:`）或 AGENTS.md 规则（`AGENTS.md: …`）开头，派生的访问检查以 `generic:` 开头。

不跑套件时，也可以用 curl 手工走一遍认证流程（需要 Node 来取出 CSRF 令牌）：

```bash
BASE=http://127.0.0.1:8000
JAR=$(mktemp)
# 登录：200，响应体里有 data.csrfToken，同时设置会话 Cookie
CSRF=$(curl -sS -c "$JAR" -H 'Content-Type: application/json' \
  -H 'X-Requested-With: ReactAdminStarter' \
  -d '{"email":"admin@example.com","password":"…"}' \
  "$BASE/api/v1/auth/login" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.csrfToken')
# 带 Cookie 恢复会话：200
curl -sS -o /dev/null -w '%{http_code}\n' -b "$JAR" "$BASE/api/v1/auth/session"
# 不带 Cookie：401 UNAUTHENTICATED
curl -sS -w '\n%{http_code}\n' "$BASE/api/v1/auth/session"
# 写请求缺少 X-Requested-With：403 REQUEST_HEADER_REQUIRED（先于会话检查）
curl -sS -w '\n%{http_code}\n' -X POST "$BASE/api/v1/auth/logout"
# 退出：200，之后同一个 Cookie 再访问会话得到 401
curl -sS -o /dev/null -w '%{http_code}\n' -b "$JAR" -X POST \
  -H 'X-Requested-With: ReactAdminStarter' -H "X-CSRF-Token: $CSRF" \
  "$BASE/api/v1/auth/logout"
curl -sS -o /dev/null -w '%{http_code}\n' -b "$JAR" "$BASE/api/v1/auth/session"
```

## 12. 常见失败的原因

| 失败现象（场景名或报错） | 常见原因 |
| --- | --- |
| `contract: missing CONTRACT_…`，退出码 2 | 环境变量没设全；`CONTRACT_BASE_URL` 带了 `/api/v1`，应只写源地址 |
| `generic: … without X-Requested-With → 403` | 检查顺序不对：来源标识必须先于会话检查，没登录的写请求缺这个头也返回 403 |
| `generic: … without a session → 401` 得到 403 或 200 | 会话检查放在了能力检查之后，或者匿名请求被当成了某个默认用户 |
| `generic: … as guest → 403 FORBIDDEN` 得到 422 或 404 | 先校验了请求体或查了记录，再检查能力；能力检查要在读请求体之前 |
| `generic: … without X-CSRF-Token → 403` | CSRF 只在部分接口检查，或者与会话无关的固定令牌也能通过 |
| `… body does not match the contract` / `success body …` | 缺少 `{ data }` 信封、字段名或类型不对（例如时间戳不是 ISO 字符串、`meta` 缺字段） |
| `error code X is not declared for <状态码>` | 用了该操作没有声明的错误码，或状态码不对；对照 OpenAPI 中该操作的响应 |
| `login: a wrong password …` 报会话 Cookie | 登录失败时仍然设置了 Cookie |
| `logout: … the old cookie then gets 401` | 退出只清除了 Cookie，没有在服务端吊销会话 |
| `listUsers: meta.total …` / 排序不对 | 先分页再过滤；`sortBy` 不认识时报错而不是回退；多值参数只读了第一个值，或用了 `status[]` |
| `uploadFile` 返回 `UNSUPPORTED_FILE_TYPE`，而文件明明是 PNG | 内容检查过严；套件发送的是能正常解码的 1×1 PNG，超大用例是同一张 PNG 加了合法的 tEXt 块 |
| `audit: … user.created …` | 没有为 `createUser` 写审计，或 `target` 里既没有用户名也没有邮箱，或 `actorEmail` 不是操作者 |
| 退出码 3，提示“跳过 Tier 2” | 没设 `CONTRACT_TIER2=1`；只想验收 Tier 1 时请明确用 `--tier 1` |
| `cleanup: …` | 场景本身通过了，但删除它创建的数据失败：删除接口、批量删除或级联约束有问题 |
| `did not finish within … ms` | 单个场景超过了 `--timeout`（默认 60 秒）。进行中的请求会被取消，下一个场景要等它停下才开始 |
