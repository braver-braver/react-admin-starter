import { auditHandlers } from './audit'
import { authHandlers } from './auth'
import { systemHandlers } from './system'
import { uploadsHandlers } from './uploads'
import { usersHandlers } from './users'

export { resetMockSessions } from './auth'

export const handlers = [
  ...authHandlers,
  ...systemHandlers,
  ...usersHandlers,
  ...uploadsHandlers,
  ...auditHandlers,
]
