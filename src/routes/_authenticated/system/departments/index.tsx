import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SystemPage } from '@/features/system'

export const Route = createFileRoute('/_authenticated/system/departments/')({
  beforeLoad: ({ context }) => {
    if (!can(context.session.user, 'system:departments:read'))
      throw redirect({ to: '/403' })
  },
  component: () => <SystemPage resource='departments' />,
})
