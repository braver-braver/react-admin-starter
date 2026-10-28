# API、会话与权限

本阶段完成 Issue #3 的前端参考实现。真实认证仍需后端按契约实现；MSW 不提供生产安全保障。用户 CRUD 对话框仍是上游交互示例，不发送写入请求，也不会保存数据；其服务端分页、增删改和完整中文化留在 Issue #4。

## 本地运行

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发环境默认启动 MSW，等待 Service Worker 就绪后才渲染应用。以下演示账户共用密码 `Demo1234!`：

| 邮箱 | 角色 | 权限 |
| --- | --- | --- |
| admin@example.com | admin | users:read、users:write、permissions:read |
| viewer@example.com | viewer | users:read、permissions:read |
| guest@example.com | guest | 无；仅可进入工作台 |

登录后可访问用户示例和权限示例。只读用户没有新增、邀请、编辑、删除或批量操作入口；访客访问这些受限页面时跳转 403。权限示例会真正发起 HTTP 请求，从 API 获取权限。开发时清除 `mock_session` Cookie，再点击“重新读取权限”，可验证 401 会清除账户与查询缓存并跳回登录页。

模拟服务将随机会话 ID 放在 Cookie 中，将模拟会话数据库放在当前标签页的 `sessionStorage` 中，支持同一标签页刷新，1 小时过期。关闭标签页或清除浏览器存储后会话失效；不保证跨标签页共享。此模拟 Cookie 可由 JavaScript 读取，浏览器内的模拟权限也可被修改，不能用于安全验证。

## 接入真实服务

设置 `VITE_ENABLE_MOCKS=false` 可在开发时关闭模拟，随后在 Vite 中配置 `/api` 代理，或让应用和 API 通过同一个反向代理提供服务。生产构建始终排除 MSW 及其处理器，即使设置 `VITE_ENABLE_MOCKS=true` 也无法开启模拟。普通生产构建的 Worker 脚本只由 Vite 开发中间件提供，不在 `public/` 或 `dist/` 中。独立的 `build:demo` 会将 Worker 与模拟接口放入 `dist-demo/`，使用 Hash 路由和按版本路径隔离的 Cookie/API/Worker；这不改变普通生产构建的边界。详见 [Pages 演示发布](pages-demo.md)。构建末尾自动检查产物，检测到 Worker、模拟会话标识或演示账户时构建失败。

前端固定访问同源 `/api`。部署时须让 `/api/*` 先路由到后端，再将前端路径回退至 `index.html`。仅部署静态文件不会自动获得认证能力：后端缺失或响应格式不符时会显示错误，无法进入管理页面。

后端负责校验凭证、签发和吊销会话、会话期限、禁用账户、权限判断、限流及审计。生产会话 Cookie 应采用 `HttpOnly; Secure; SameSite=Lax`、适当 Path 和过期时间。登录后旋转会话 ID，退出后在服务端吊销；不要把演示账户或模拟令牌作为生产后门。

所有写请求携带 `X-Requested-With: ReactAdminStarter`；已登录写请求还需 `X-CSRF-Token`。服务端必须验证来源 Origin 与 CSRF，禁止任意跨域源携带凭证访问。前端无法设置 HttpOnly Cookie，也无法替后端实施这些策略。

## 契约

可供后端对接的定义见 [OpenAPI](api.openapi.yaml)。运行时使用 `src/features/auth/schema.ts` 的 Zod 契约验证成功响应；业务 API 函数放在各 feature 下，公共传输层在 `src/lib/api.ts`。不依赖 GoFrame 或特定业务响应码。

成功响应为 `{ "data": T }`。失败使用正确 HTTP 状态码及 `{ "error": { "code": "...", "message": "..." } }`，不允许以 HTTP 200 返回登录失败。错误 message 应可直接展示，不能含凭证或内部堆栈。

| 方法 | 路径 | 成功 data | 行为 |
| --- | --- | --- | --- |
| POST | /api/auth/login | Session | JSON `{email,password}`；设置会话 Cookie |
| GET | /api/auth/session | Session | 验证当前会话并返回当前权限；未登录返回 401 |
| POST | /api/auth/logout | `{success:true}` | 校验 CSRF、吊销会话、清除 Cookie |
| GET | /api/auth/permissions | `{roles,permissions}` | 需要 permissions:read；否则 403 |

Session 包含 `user: {id,email,name,roles,permissions}` 和非空 `csrfToken`。权限字段是普通字符串数组；未识别或缺失的权限默认拒绝，角色名称不隐含管理员通配能力。接口响应应采用 `Cache-Control: no-store`。

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

测试覆盖 API 格式与错误、MSW 会话与 CSRF、登录和退出交互、路由和菜单权限、旧请求竞争。真实后端的 HttpOnly、服务端授权、会话吊销与跨标签页一致性仍须后端集成验收。
