import { handlers } from '@/mocks/handlers'
import { setupWorker } from 'msw/browser'

/**
 * 测试专用的 MSW worker 实例（与开发用的 src/mocks/browser.ts 分开），
 * 通过 start/stop/reset 辅助函数控制生命周期。
 */
const mockWorker = setupWorker(...handlers)

export async function startMockApi(): Promise<void> {
  await mockWorker.start({ onUnhandledFrame: 'bypass', quiet: true })
}

export async function stopMockApi(): Promise<void> {
  await mockWorker.stop()
}

export function resetMockApi(): void {
  mockWorker.resetHandlers()
}
