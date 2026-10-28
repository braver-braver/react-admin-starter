import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { Permissions } from '@/features/permissions'

export const Route = createFileRoute('/_authenticated/permissions/')({
  beforeLoad: ({ context }) => {
    if (!can(context.session.user, 'permissions:read'))
      throw redirect({ to: '/403' })
  },
  component: Permissions,
})
