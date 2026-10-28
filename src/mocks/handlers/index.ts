import { auditHandlers } from './audit'
import { authHandlers } from './auth'
import { uploadsHandlers } from './uploads'
import { usersHandlers } from './users'

export { resetMockSessions } from './auth'

export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...uploadsHandlers,
  ...auditHandlers,
]
