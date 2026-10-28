import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { fetchUsers } from './api'
import { type UsersListParams } from './data/schema'

/** 列表查询前缀：任何写操作成功后用 ['users'] 整体失效 */
export const usersQueryKey = ['users'] as const

export function usersQueryOptions(params: UsersListParams) {
  return queryOptions({
    queryKey: [...usersQueryKey, params],
    queryFn: () => fetchUsers(params),
    placeholderData: keepPreviousData,
  })
}
