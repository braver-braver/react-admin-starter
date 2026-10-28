import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * MSW 浏览器 worker。只在开发引导（src/main.tsx）和测试中
 * 通过动态导入加载，永远不会进入生产构建。
 */
export const worker = setupWorker(...handlers)
