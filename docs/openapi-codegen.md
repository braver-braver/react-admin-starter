# 用 OpenAPI 生成后端桩代码与客户端

`docs/api.openapi.json` 由 `src/contract` 生成（`pnpm contract:generate`），是 `/api/v1` 的机器可读版本。本页说明如何用它为其他语言生成服务端骨架或客户端，以及生成代码**做不到**的部分。生成物不放进本仓库，放在使用它的后端或客户端项目里。

先读[后端接入指南](backend-integration.md)：生成器只帮你得到路由、模型和类型，会话、授权、数据范围和请求检查顺序仍要按指南实现，并用 `pnpm test:contract` 验收。

## 1. 取得锁定版本的契约

后端应锁定一个已发布版本，而不是跟着 `main` 走。从 `v1.0.0` 起，发布流程（[releasing.md](releasing.md) 第 3 步）把当时的 `api.openapi.json` 作为 Release 附件上传：

```bash
gh release download v1.0.0 --repo braver-braver/react-admin-starter --pattern api.openapi.json
# 或：https://github.com/braver-braver/react-admin-starter/releases/download/v1.0.0/api.openapi.json
```

任何 Tag 都可以直接取仓库里的文件，与附件内容相同；`v1.0.0-rc.*` 没有附件，只能用这种方式：

```bash
curl -fsSLO https://raw.githubusercontent.com/braver-braver/react-admin-starter/v1.0.0/docs/api.openapi.json
```

文档的基本事实：

- `openapi: 3.1.0`，`info.version` 等于包版本。
- `servers` 是相对地址 `/api/v1`。前端按同源部署（见后端接入指南第 9 节），生成客户端时把基础地址设成你的源加 `/api/v1`。
- 认证是同源 Cookie 会话：`components.securitySchemes.sessionCookie`（`apiKey`，`in: cookie`）。浏览器里的客户端要带凭据（`fetch` 的 `credentials: 'same-origin'` 或 `'include'`）。
- 写请求的两个请求头在 `components.parameters` 里：`RequestedWith`（`X-Requested-With: ReactAdminStarter`，所有写操作）和 `CsrfToken`（`X-CSRF-Token`，除登录外的写操作）。
- 每个响应都有组件名（`User`、`AuditList`、`SystemAccount` 等）。`ErrorCode` 是完整的错误码目录，没有被任何操作直接引用，所以 `openapi-generator validate` 会提示 “Unused model: ErrorCode”，这是正常的。

## 2. 实测过的生成器

下面的命令都在 2026-11-06 对 `v1.0.0` 的文档实际运行过，命令里写的就是当时的确切版本。在自己的项目里也要这样锁定生成器版本，升级时重新生成并检查差异，不要用 `@latest` 或只写主版本。

| 工具（版本） | 生成内容 | 实测结果 |
| --- | --- | --- |
| [openapi-typescript](https://openapi-ts.dev/)（7.13.0） | TypeScript 类型 | 成功；`tsc --strict` 通过 |
| [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)（v2.8.2） | Go 服务端接口与模型 | 成功；`go build` 通过，`StrictServerInterface` 共 36 个方法，与操作数一致 |
| [openapi-generator](https://openapi-generator.tech/)（7.27.0） | 多语言客户端与服务端 | `typescript-fetch`、`spring`、`python-fastapi` 均成功，并提示 “OpenAPI 3.1 support is still in beta”；`typescript-fetch` 通过 `tsc --strict`，FastAPI 通过语法检查，Spring 未编译 |
| [datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator)（0.89.0） | Python Pydantic v2 模型 | 成功，可导入；邮箱字段是 `EmailStr`，需要安装 `pydantic[email]`；带时区的时间是 `AwareDatetime` |

### TypeScript 类型

```bash
npx openapi-typescript@7.13.0 api.openapi.json -o src/api.d.ts
```

### Go 服务端（oapi-codegen）

```yaml
# oapi-codegen.yaml
package: api
generate:
  std-http-server: true
  strict-server: true
  models: true
output: api.gen.go
```

```bash
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2 -config oapi-codegen.yaml api.openapi.json
```

在已有 `go.mod` 的目录里运行。把它写进 `go generate` 或 `tools.go`，就能固定版本。

### 其他语言（openapi-generator）

```bash
# 需要 Java；也可以用官方 Docker 镜像 openapitools/openapi-generator-cli
java -jar openapi-generator-cli-7.27.0.jar validate -i api.openapi.json
java -jar openapi-generator-cli-7.27.0.jar generate -i api.openapi.json -g spring -o server
java -jar openapi-generator-cli-7.27.0.jar generate -i api.openapi.json -g python-fastapi -o server
java -jar openapi-generator-cli-7.27.0.jar generate -i api.openapi.json -g typescript-fetch -o client
```

`-g` 的其他取值见 `java -jar openapi-generator-cli-7.27.0.jar list`。它对 3.1 的支持仍是 beta，换生成器时先跑一遍 `validate` 和你自己的编译。

### Python 模型

```bash
uvx --from datamodel-code-generator==0.89.0 datamodel-codegen \
  --input api.openapi.json --input-file-type openapi \
  --output-model-type pydantic_v2.BaseModel --output models.py
```

## 3. 生成代码做不到的事

生成的服务端只是骨架，“能编译”不等于符合契约。下面这些必须自己实现，并由一致性套件验收：

1. **请求检查的顺序和错误格式。** 契约要求先检查来源标识、再检查会话、能力和 CSRF（后端接入指南第 3 节）：缺少 `X-Requested-With` 时返回 **403 `REQUEST_HEADER_REQUIRED`**，并且在会话检查之前。但生成的框架会自己校验必填请求头，抢先给出别的结果。实测：oapi-codegen 默认的 `ErrorHandlerFunc` 返回纯文本 400；FastAPI 的 `Header(...)` 默认返回 422；Spring 的 `@RequestHeader` 默认返回 400。做法是把这几项检查放进在参数绑定**之前**运行的中间件，并替换框架的参数错误处理，让它输出契约的 `{ "error": { "code", "message" } }` 信封。
2. **参数的宽松处理。** 有些规则是“截断或回退”，不是“拒绝”：`pageSize` 超过 100 时截断为 100（决策 D3），非法的 `sortBy` 回退为默认排序（决策 D6）。严格的参数校验会把它们变成 400 或 422，要按契约放宽。
3. **授权与数据范围。** 每个操作需要的能力写在操作的 `description`（如 “Requires `audit:read`”）和后端接入指南第 5 节里，schema 不会替你检查。数据范围要先过滤、再计数和分页，批量操作中只要有一条越界就整体拒绝。
4. **schema 表达不了的校验。** 例如名称先 `trim` 再限制长度（决策 D7），生成的 `maxLength` 按原始字符串计算。这类规则以契约源码和一致性场景为准。
5. **会话与 CSRF。** Cookie 的属性、`csrfToken` 的签发与轮换、退出后会话失效，见后端接入指南第 2 节。

写完后对你的实现运行 `pnpm test:contract`（后端接入指南第 11 节）。Tier 1 通过才算可用；生成的类型对上了，不代表行为对上了。

## 4. 跟随契约升级

- 锁定版本：契约（Release 附件）和生成器都写死版本号。
- 在后端项目的 CI 里重新生成，并检查生成结果与提交的版本一致，避免手改生成代码。
- `/api/v1` 在 v1.0.0 之后只做向后兼容的变更（新增操作、可选字段、响应字段、错误码和能力码），升级小版本时重新生成即可；破坏性变更会出现在新的 `/api/v2` 和新的主版本里，见 [AGENTS.md](../AGENTS.md) 的 API compatibility。
- 新增错误码时，已有客户端若把 `error.code` 当成封闭枚举，可能遇到未知值；客户端应按 HTTP 状态兜底处理未知错误码。
