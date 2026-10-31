# API、会话与权限

本阶段完成 Issue #3 与 Issue #4 的前端参考实现：Cookie 会话、RBAC、服务端分页 CRUD、文件上传与操作审计都已落到真实 HTTP 请求上，开发环境由 MSW 提供数据。Issue #20 在此之上加入统一系统管理：登录账号、角色、权限、菜单、部门与部门数据范围，模型详见 [系统管理与统一授权](system-management.md)。真实认证与授权仍需后端按契约实现；MSW 不提供生产安全保障。

## 本地运行

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发环境默认启动 MSW，等待 Service Worker 就绪后才渲染应用。以下演示账户共用密码 `Demo1234!`：

| 邮箱 | 角色 | 权限 |
| --- | --- | --- |
| admin@example.com | admin（内置保护） | 全部权限与菜单，数据范围为全部 |
| viewer@example.com | viewer | users:read、permissions:read |
| guest@example.com | guest | 无；仅可进入工作台 |

演示账号本身就是系统管理里的登录账号记录：角色、菜单与数据范围可以在「系统管理」页面调整，保存后旧会话与导航立即重算。登录后可访问用户示例、权限示例、审计日志和系统管理。只读用户没有新增、邀请、编辑、删除或批量操作入口，也看不到审计日志；访客访问这些受限页面时跳转 403。侧边栏与命令搜索只显示服务端下发的菜单；直接输入未授权路由的 URL 会被守卫拦截到 403。权限示例会真正发起 HTTP 请求，从 API 获取权限。开发时清除 `mock_session` Cookie，再点击“重新读取权限”，可验证 401 会清除账户与查询缓存并跳回登录页。

模拟服务将随机会话 ID 放在 Cookie 中，将模拟会话数据库放在当前标签页的 `sessionStorage` 中，支持同一标签页刷新，1 小时过期。关闭标签页或清除浏览器存储后会话失效；不保证跨标签页共享。此模拟 Cookie 可由 JavaScript 读取，浏览器内的模拟权限也可被修改，不能用于安全验证。

## 接入真实服务

设置 `VITE_ENABLE_MOCKS=false` 可在开发时关闭模拟，再设置 `VITE_API_PROXY_TARGET=http://127.0.0.1:8000`（后端的源地址，不带路径）后，`pnpm dev` 和 `pnpm preview` 会把 `/api` 转发到该后端，使其成为同源 API；不设置时不启用代理。生产部署则让应用和 API 通过同一个反向代理提供服务。E2E 里的 `production-api` 项目就是这样运行的：普通生产构建加 `/api` 代理，后端是一致性套件的替身服务器（测试替身，不是参考后端），用来验证登录、刷新后恢复会话、退出都能走通。生产构建始终排除 MSW 及其处理器，即使设置 `VITE_ENABLE_MOCKS=true` 也无法开启模拟。普通生产构建的 Worker 脚本只由 Vite 开发中间件提供，不在 `public/` 或 `dist/` 中。单独的 `build:demo` 会将模拟 Worker 与接口放入 `dist-demo/`，通过 Hash 路由和按版本路径隔离的 Cookie/API/Worker 提供静态展示，但不会改变普通生产构建的安全边界。参见 [GitHub Pages 演示部署](pages-demo.md)。构建末尾自动检查产物，检测到 Worker、模拟会话标识或演示账户时构建失败。

前端固定访问同源 `/api/v1`。部署时须让 `/api/*` 先路由到后端（按 `/api/` 前缀转发即可，将来新增的 `/api/v2` 也随之覆盖），再将前端路径回退至 `index.html`。仅部署静态文件不会自动获得认证能力：后端缺失或响应格式不符时会显示错误，无法进入管理页面。

**API 版本：** 路径中的 `v1` 是 API 主版本，前缀常量 `API_PREFIX` 定义在 `src/contract/common.ts`，客户端、Mock 与 OpenAPI 共用。v1.0 之后的破坏性变更（删除、改名、改类型、收紧校验）走新的 `/api/v2` 路径并升包的主版本；旧版本保留多久由后端决定，前端模板一次只对接一个主版本。OpenAPI 的 `info.version` 跟随包版本。

后端负责校验凭证、签发和吊销会话、会话期限、禁用账户、权限判断、限流及审计。生产会话 Cookie 应采用 `HttpOnly; Secure; SameSite=Lax`、适当 Path 和过期时间。登录后旋转会话 ID，退出后在服务端吊销；不要把演示账户或模拟令牌作为生产后门。

所有写请求（POST、PUT、PATCH、DELETE）都必须携带 `X-Requested-With: ReactAdminStarter`，缺失一律返回 403 `REQUEST_HEADER_REQUIRED`，且先于登录与权限检查；已登录写请求还需 `X-CSRF-Token`。服务端必须验证来源 Origin 与 CSRF，禁止任意跨域源携带凭证访问。前端无法设置 HttpOnly Cookie，也无法替后端实施这些策略。

## 契约

可供后端对接的定义见 [OpenAPI](api.openapi.json)。它由 `src/contract/` 的 Zod 契约生成（`pnpm contract:generate`），不要手改；CI 用 `pnpm contract:check` 检查文件与契约一致。运行时用同一份 Zod 契约验证成功响应；业务 API 函数放在各 feature 下，统一调用 `src/lib/api.ts` 的 `callOperation('<operationId>', { params, query, body })`：方法、路径、查询序列化（数组用重复键）、JSON 或 multipart 编码以及响应校验都取自契约注册表，参数与返回值的类型也由注册表推导；业务代码不手写 `/api` 路径（有单测扫描源码保证）。请求构建是 `src/contract/request.ts` 中的纯函数，Node 端的一致性测试也可复用。不依赖 GoFrame 或特定业务响应码。一致性套件（`src/contract/conformance/`）用同一组场景检查 Mock 与真实后端，运行前后端需准备的账号与数据见 [一致性套件夹具清单](conformance-fixtures.md)。

时间戳（`createdAt`、`updatedAt`）一律是 ISO 8601 date-time 字符串，如 `2026-10-30T10:00:00Z`，允许小数秒与 `±hh:mm` 偏移；数字、布尔值、`null` 或无时区字符串都会被前端拒绝。响应对象允许出现契约之外的新增字段（前端忽略）；系统管理的请求体不允许未知字段。

成功响应为 `{ "data": T }`。失败使用正确 HTTP 状态码及 `{ "error": { "code": "...", "message": "..." } }`，不允许以 HTTP 200 返回登录失败。错误 message 应可直接展示，不能含凭证或内部堆栈。

| 方法 | 路径 | operationId | 成功 data | 行为 |
| --- | --- | --- | --- | --- |
| POST | /api/v1/auth/login | login | Session | JSON `{email,password}`；设置会话 Cookie |
| GET | /api/v1/auth/session | getSession | Session | 验证当前会话并返回当前权限；未登录返回 401 |
| POST | /api/v1/auth/logout | logout | `{success:true}` | 校验 CSRF、吊销会话、清除 Cookie |
| GET | /api/v1/auth/permissions | getPermissions | `{roles,permissions}` | 需要 permissions:read；否则 403 |
| GET | /api/v1/auth/navigation | getNavigation | Menu[] | 返回当前账号启用且授权的菜单；停用菜单同时撤销路由访问 |
| GET | /api/v1/system/options | getSystemOptions | `{items: SystemRecord[]}` | 需要至少一个 system:{resource}:read；只返回对应资源已授权的角色/权限/菜单/部门记录（部门进一步按范围过滤） |
| GET | /api/v1/system/{resource} | listSystem{Resource}s | `{items,meta}` | 需要 `system:{resource}:read`；支持 page、pageSize、search |
| POST | /api/v1/system/{resource} | createSystem{Resource} | 对应资源记录 | 需要 `system:{resource}:write` 与 CSRF；校验引用、层级与越权后创建 |
| PUT | /api/v1/system/{resource}/{id} | updateSystem{Resource} | 对应资源记录 | 需要 `system:{resource}:write` 与 CSRF；保护记录返回 409 |
| DELETE | /api/v1/system/{resource}/{id} | deleteSystem{Resource} | `{success:true}` | 需要 `system:{resource}:write` 与 CSRF；仍被引用时返回 409 |
| GET | /api/v1/users | listUsers | `{items,meta}` | 需要 users:read；分页、筛选、排序由服务端计算；按数据范围过滤 |
| POST | /api/v1/users | createUser | User | 需要 users:write 与 CSRF；重复邮箱/用户名返回 422 |
| PUT | /api/v1/users/{id} | updateUser | User | 需要 users:write 与 CSRF；未知用户返回 404 |
| DELETE | /api/v1/users/{id} | deleteUser | `{success:true}` | 需要 users:write 与 CSRF |
| POST | /api/v1/users/batch-delete | batchDeleteUsers | `{deletedCount}` | 批量删除所选用户 |
| PATCH | /api/v1/users/status | updateUsersStatus | `{updatedCount}` | 批量启用/停用 |
| POST | /api/v1/users/invite | inviteUser | User（status=invited） | 邀请单个用户 |
| POST | /api/v1/users/invite-batch | inviteUsersBatch | `{invitedCount}` | 批量邀请所选用户 |
| POST | /api/v1/uploads | uploadFile | UploadedFile | multipart `file`；仅图片、≤2MB；需要 users:write 与 CSRF |
| GET | /api/v1/audit-logs | listAuditLogs | `{items,meta}` | 需要 audit:read；按 action 过滤，最新在前 |

`{resource}` 为 `accounts`、`roles`、`permissions`、`menus`、`departments`，对应的 `{Resource}` 为 `Account`、`Role`、`Permission`、`Menu`、`Department`（如 `listSystemAccounts`、`createSystemRole`）。每个操作可能返回的错误码按状态码列在 [OpenAPI](api.openapi.json) 中；所有写操作缺少 `X-Requested-With` 时返回 403 `REQUEST_HEADER_REQUIRED`。

列表接口接受 `page`、`pageSize`、`username`（匹配用户名/邮箱/姓名/电话）、`status`、`role`、`sortBy`、`sortOrder`；多值参数一律用重复键（`status=active&status=invited`），键名不带方括号；`pageSize` 超过 100 按 100 处理；返回 `{items, meta: {page,pageSize,total,totalPageCount}}`。所有分页列表（用户、审计流水、系统管理的五种资源）共用这一种信封，`pageSize` 上限都是 100，`totalPageCount` 至少为 1。`sortBy` 仅接受白名单字段（username、fullName、email、phoneNumber、status、role、createdAt、updatedAt），非法值回退到 username。

上传契约返回 `{id,name,url,contentType,size}`。演示环境用浏览器对象 URL 直接预览，刷新后失效；真实服务应返回持久化下载地址，并在服务端再次校验类型与大小。

审计流水记录登录、退出、用户增删改、批量删除、状态变更、邀请、批量邀请与系统配置变更（`system.changed`），字段为 `{id,createdAt,actorName,actorEmail,action,target,detail,ip}`。演示数据预置 120 个用户与 46 条审计记录；所有写入都是内存态，刷新页面后重置。

Session 包含 `user: {id,email,name,roles,permissions,routes,departmentId,dataScopes}` 和非空 `csrfToken`。权限字段是普通字符串数组；未识别或缺失的权限默认拒绝，角色名称不隐含管理员通配能力。`routes` 是账号可访问的路径列表，守卫据此拦截直接 URL 访问；`dataScopes` 按权限映射数据范围，语义见 [系统管理与统一授权](system-management.md)。接口响应应采用 `Cache-Control: no-store`。

## 生命周期与错误

- 进入受保护路由时先向服务端恢复并验证会话，验证失败前不渲染布局；网络错误与格式错误显示可重试错误，不能冒充已登录状态。
- 401 清除内存身份与 TanStack Query 缓存，取消旧查询，返回登录页；403 保留身份并显示无权访问。读取与写入请求共用同一错误入口。
- 登录失败显示服务端错误且允许重试；退出网络错误或 CSRF 错误保留当前身份并允许重试。退出返回 401 视为会话已经失效。
- 登录与退出请求串行执行，避免 Cookie 响应乱序；身份切换会隔离旧请求，迟到的成功响应或 401 不能覆盖新会话。权限变化也会清理旧查询缓存。
- 登录返回地址仅接受同源站内路径，拒绝外部 URL、协议相对地址、反斜杠、控制字符和登录页回环。
- 内存 store 不持久化会话令牌、角色或权限。浏览器刷新后重新请求 session，客户端路由、菜单和按钮守卫均只改善交互；每次后端操作仍须独立鉴权。

## 验证

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

测试覆盖 API 格式与错误、MSW 会话与 CSRF、用户 CRUD 的服务端分页/筛选/排序、批量操作与写权限拒绝、上传类型与权限校验、审计流水与 audit:read、登录和退出交互、路由和菜单权限、旧请求竞争。真实后端的 HttpOnly、服务端授权、会话吊销与跨标签页一致性仍须后端集成验收。

**Mock 契约守卫：** 开发、演示与测试中，`src/mocks/contract-guard.ts` 按操作注册表检查每个 Mock 响应：状态码必须是该操作声明过的，成功体必须符合 `{ data }` 与对应 schema，错误码必须是该状态下声明过的；违规在控制台报 `[contract-guard]`，测试中直接失败。`src/mocks/handlers.test.ts` 还校验 Mock 路由与注册表双向一致，并要求全部 36 个操作都至少走过一次成功路径和一次声明的错误路径。守卫只由 `mocks/browser.ts` 引入，不进入普通生产构建。

## 系统管理会话扩展

会话现在同时返回 `routes`、`departmentId` 与按能力代码索引的 `dataScopes`。`dataScope` 是总体摘要，操作鉴权必须读取对应能力的范围。前端从 `/api/v1/auth/navigation` 加载侧栏与命令搜索，受保护路由默认拒绝未下发的路径。账号密码重置、停用/再启用及删除会吊销旧会话；角色授权在每次 Mock API 请求时重算。后端升级必须实现这些字段与接口，详见 [系统管理与统一授权](system-management.md)。
