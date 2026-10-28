import { queryOptions } from '@tanstack/react-query'
import { fetchSession } from './api'

/**
 * 当前会话的查询配置。受保护路由在 beforeLoad 里
 * ensureQueryData，保证进入页面前拿到已校验的用户信息。
 */
export const sessionQueryOptions = queryOptions({
  queryKey: ['auth', 'session'],
  queryFn: async () => {
    const user = await fetchSession()
    return user
  },
  staleTime: 5 * 60 * 1000,
})
