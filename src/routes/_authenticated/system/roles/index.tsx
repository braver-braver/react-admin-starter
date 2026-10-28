import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SystemPage } from '@/features/system'

export const Route = createFileRoute('/_authenticated/system/roles/')({
  beforeLoad: ({ context }) => {
    if (!can(context.session.user, 'system:roles:read'))
      throw redirect({ to: '/403' })
  },
  component: () => <SystemPage resource='roles' />,
})
