/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST 服务基地址，默认 '/api'；对接真实后端时配置。 */
  readonly VITE_API_BASE_URL?: string
  /** 开发环境下是否启用 MSW mock API，默认 'true'；设为 'false' 时请求直连真实服务。 */
  readonly VITE_ENABLE_MSW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
