import { type User } from '../data/schema'

/** Row id for TanStack Table, so selection survives server-side paging. */
export function getUserRowId(user: User) {
  return user.id
}
