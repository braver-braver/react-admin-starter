# 新增业务模块（契约优先）

本指南按**契约优先**的顺序，把一个新业务模块从接口定义一路接到页面和一致性套件。每一步先说明要改哪里，再给出最小代码骨架。

真实参照是审计日志：一个只读列表操作 `listAuditLogs`，一个能力码 `audit:read`，使用统一的列表信封。下文用一个假想的“公告”模块（`announcements`）演示，包含一个列表和一个创建操作，以便覆盖写请求的规则。代码块只是示意，仓库里**没有**这个模块。

开工前先读 [AGENTS.md](../AGENTS.md)（尤其是 API compatibility）、[接口与认证](auth-and-api.md)、[后端接入指南](backend-integration.md)和[系统管理](system-management.md)。

## 0. 先回答四个问题

1. **资源名与路径**：所有路径都在 `/api/v1` 下（常量 `API_PREFIX`），例如 `GET /api/v1/announcements`、`POST /api/v1/announcements`。
2. **能力码**：读写分开，例如 `announcements:read`、`announcements:write`。服务端必须校验，前端的路由与按钮守卫只影响体验。
3. **数据范围**：记录是否按部门或本人过滤？要过滤时，每个能力单独计算范围，先过滤再计数和分页，批量操作中只要有一条越界就整体拒绝（见 [system-management.md](system-management.md)）。
4. **兼容性**：v1.0.0 之后，`/api/v1` 只接受向后兼容的变更。新增操作、可选请求字段、响应字段、错误码和能力码都可以；能力码在线上是普通字符串，`Permission` 联合类型只在编译期存在。改名、删字段、收紧校验、改状态码等破坏性变更必须走 `/api/v2` 并升主版本。

## 1. 契约：Zod schema

新建 `src/contract/announcements.ts`。契约目录只能导入 `zod` 和同目录的 `.ts` 文件，不能用 `@/` 别名、`import.meta.env` 或 React，否则 `src/contract/operations.test.ts` 会失败（Node 要能直接加载它来生成 OpenAPI）。

参照 `src/contract/audit.ts`，复用 `src/contract/common.ts` 里的 `listEnvelope`、`pageSizeQuery` 和 `wireDate`：

```ts
import { z } from 'zod'
import { listEnvelope, pageSizeQuery, wireDate } from './common.ts'

export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  publishedAt: wireDate, // 线上是带时区的 ISO 字符串，客户端拿到 Date
})

export const announcementInput = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().max(2000),
})

export const announcementQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: pageSizeQuery, // 超过 100 时截断为 100（决策 D3）
})

export const announcementListResponseSchema = listEnvelope(announcementSchema)
```

`refine` 和 `transform` 不会进入 JSON Schema。用 `.meta({ description })` 写明这类规则，并在一致性场景里覆盖它们（风险 R1）。

## 2. 能力码与注册表

1. 在 `src/contract/permissions.ts` 的 `Permission` 联合类型里加上 `'announcements:read' | 'announcements:write'`。
2. 在 `src/contract/operations.ts` 的 `operations` 数组里登记两个操作。错误集合复用文件里已有的 `guarded`（读）和 `guardedWrite`（写）；按部门过滤的写操作用 `scopedWrite`：

```ts
{
  id: 'listAnnouncements',
  method: 'GET',
  path: '/announcements',
  summary: 'List announcements, newest first',
  permission: 'announcements:read',
  auth: 'session',
  csrf: false,
  query: announcementQuerySchema,
  success: { status: 200, schema: announcementListResponseSchema },
  errors: guarded,
},
{
  id: 'createAnnouncement',
  method: 'POST',
  path: '/announcements',
  summary: 'Publish an announcement',
  permission: 'announcements:write',
  auth: 'session',
  csrf: true,
  body: announcementInput,
  success: { status: 201, schema: announcementSchema },
  errors: { ...guardedWrite, 422: ['INVALID_ANNOUNCEMENT_FIELDS'] },
},
```

3. 错误码按资源定义，例如已有的 `INVALID_USER_FIELDS`。新的业务错误码（这里是 `INVALID_ANNOUNCEMENT_FIELDS`，状态 422）要登记到 `src/contract/errors.ts` 的 `errorCatalog`，写明含义；新增错误码属于向后兼容的变更。
4. 把能力登记到 `src/features/system/catalog.ts` 的 `apiCatalog`，这样它才会出现在权限管理里、可以分配给角色。Mock 的权限种子由 `apiCatalog` 生成，内置管理员角色自动拥有它。

`src/contract/operations.test.ts` 固定了操作总数、错误码总数和每条规则：写操作必须声明 CSRF 和来源标识错误；声明的错误码必须在目录里且状态对得上；目录里每个操作级错误码至少被一个操作使用，Mock 能返回的每个错误码都必须在目录里。新增操作或错误码后，把那里的计数改成新的数量。

## 3. 生成 OpenAPI 并同步文档

```bash
pnpm contract:generate   # 重写 docs/api.openapi.json
pnpm contract:check      # CI 跑的就是它，漂移即失败
```

然后同步三处会被测试核对的文档：

- `docs/auth-and-api.md` 的操作表：每个操作一行（由 `src/contract/docs-sync.test.ts` 核对）。
- `docs/backend-integration.md` 的错误码表、能力码表和页面表（由 `src/contract/backend-guide.test.ts` 核对）。
- `CHANGELOG.md` 的 Unreleased。

## 4. Mock：存储与处理器

参照 `src/mocks/data/audit.ts`（内存存储）和 `src/mocks/handlers/audit.ts`（处理器）。新建 `src/mocks/handlers/announcements.ts`，按[后端接入指南](backend-integration.md)第 3 节的顺序做检查：来源标识 → 会话 → 能力 → CSRF。用到的工具都在 `src/mocks/handlers/auth.ts`：

```ts
import { HttpResponse, http } from 'msw'
import {
  apiBase,
  apiError,
  currentSession,
  requireCsrf,
  requirePermission,
  requireRequestedWith,
} from './auth'

export const announcementsHandlers = [
  http.get(`${apiBase}/announcements`, ({ cookies }) => {
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied = requirePermission(session, 'announcements:read')
    if (denied) return denied
    // 先过滤（数据范围、筛选条件），再计数和分页
    return HttpResponse.json({ data: { items: [], meta: { page: 1, pageSize: 10, total: 0, totalPageCount: 1 } } })
  }),
  http.post(`${apiBase}/announcements`, async ({ request, cookies }) => {
    const missing = requireRequestedWith(request)
    if (missing) return missing
    const session = currentSession(cookies)
    if (!session) return apiError(401, 'UNAUTHENTICATED', '请先登录。')
    const denied =
      requirePermission(session, 'announcements:write') ??
      requireCsrf(request, session)
    if (denied) return denied
    // 用契约里的 announcementInput 校验请求体；失败时返回 422
    // 写入存储，并按需调用 appendAuditLog 留下审计记录
    return HttpResponse.json({ data: { /* 新记录 */ } }, { status: 201 })
  }),
]
```

在 `src/mocks/handlers/index.ts` 的 `handlers` 里加上 `...announcementsHandlers`。

不需要手写响应格式的检查：开发环境里，`src/mocks/contract-guard.ts` 会把每个 Mock 响应和注册表比对，状态码未声明、响应体不符合 schema 或错误码未声明都会报出来。`src/mocks/handlers.test.ts` 会对注册表里的每个操作发真实 HTTP 请求：没有来源标识的写请求必须得到 403，没有会话的读请求必须得到 401。

## 5. 客户端：API、查询与页面

按功能目录组织，新建 `src/features/announcements/`。参照 `src/features/audit/`：

- `api.ts`：**只**通过注册表发请求。`callOperation` 按操作 id 推断参数和返回类型，并在运行时校验响应：

  ```ts
  import { callOperation } from '@/lib/api'
  export const fetchAnnouncements = (query: AnnouncementListParams) =>
    callOperation('listAnnouncements', { query })
  ```

- `queries.ts`：TanStack Query 的 `queryOptions`，查询键里带上参数。参照 `src/features/audit/queries.ts`。
- `index.tsx` 与 `components/`：表格优先用服务端分页、筛选和排序。共享文案和格式化按 [i18n.md](i18n.md) 的约定。

## 6. 路由与导航

1. **路由**：新建 `src/routes/_authenticated/announcements/index.tsx`，参照 `src/routes/_authenticated/audit/index.tsx`。在 `beforeLoad` 里用 `can()` 检查能力，并用 Zod 校验 URL 查询参数。TanStack Router 插件会自动重新生成 `src/routeTree.gen.ts`。
2. **导航**：导航来自服务端下发的菜单，菜单只能引用已登记的路由 ID。在 `src/features/system/catalog.ts` 的 `routeCatalog` 里加一项 `{ id: 'announcements', path: '/announcements', name: '公告', permission: 'announcements:read' }`。Mock 的菜单种子由 `routeCatalog` 生成；图标在 `src/features/system/navigation.ts` 的 `icons` 里按路由 ID 配置，没有配置时用默认图标。
3. 隐藏菜单不等于撤销权限：没有 `announcements:read` 的账户，服务端仍必须拒绝请求。

## 7. 一致性场景

- **通用场景不用写**：`src/contract/conformance/generic.ts` 会按注册表为每个新操作自动生成未登录、缺少来源标识、访客（无能力）和缺少 CSRF 令牌的场景。
- **业务场景要写**：在 `src/contract/conformance/tier1.ts` 加 Tier 1 场景，参照其中的 `listAuditLogs` 场景：只读账户得到 `403 FORBIDDEN`、管理员能读、列表按时间倒序。创建出来的数据带 `unique()` 前缀，场景结束前删掉并核对。
- 有数据范围时，在 `src/contract/conformance/tier2.ts` 加 Tier 2 场景。需要新夹具时，更新 `docs/conformance-fixtures.md`。

`pnpm test:conformance` 用 Mock 跑整套场景；后端项目用 `pnpm test:contract` 对自己的实现跑同一套（见[后端接入指南](backend-integration.md)第 11 节）。

## 8. 收尾检查

提交 PR 前运行 [贡献指南](../.github/CONTRIBUTING.md) 列出的命令；改了页面和路由时还要跑 `pnpm test:e2e`。漏掉某一步时，下面这些检查会失败：

| 漏掉的步骤 | 失败的检查 |
| --- | --- |
| 契约文件导入了 `@/`、React 或 `import.meta.env` | `src/contract/operations.test.ts`（契约目录导入限制） |
| 注册表里的操作或错误码计数、CSRF 或错误声明不对；新错误码没有登记 | `src/contract/operations.test.ts` |
| 改了契约但没有重新生成 OpenAPI | `pnpm contract:check` |
| 操作表没有同步 | `src/contract/docs-sync.test.ts` |
| 错误码表、能力码表或页面表没有同步 | `src/contract/backend-guide.test.ts` |
| 没有注册 Mock 处理器，或处理器没检查来源标识或会话 | `src/mocks/handlers.test.ts`（逐个操作的 HTTP 覆盖） |
| Mock 响应不符合注册表 | 开发环境的 Mock 契约守卫；`pnpm test:conformance` |
| 新增导出没有被使用 | `pnpm knip` |
| 普通生产构建里混入 Mock 或演示账户 | `pnpm build` 末尾的生产产物检查 |

本指南引用的文件路径与名称由 `src/contract/module-guide.test.ts` 核对，重构后若对不上，测试会失败。
