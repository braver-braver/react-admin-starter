import { redirect } from '@tanstack/react-router'
import { ApiError } from '@/lib/api'
import { type Permission, can } from '@/lib/permissions'
import { loadSession, safeRedirect } from './session'

export async function requireSession(href: string, permission?: Permission) {
  try {
    const session = await loadSession()
    if (permission && !can(session.user, permission))
      throw redirect({ to: '/403' })
    return { session }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: safeRedirect(href) },
      })
    }
    if (error instanceof ApiError && error.status === 403)
      throw redirect({ to: '/403' })
    throw error
  }
}
