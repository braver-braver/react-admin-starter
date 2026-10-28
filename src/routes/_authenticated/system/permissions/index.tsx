import { createFileRoute, redirect } from '@tanstack/react-router'
import { can } from '@/lib/permissions'
import { SystemPage } from '@/features/system'

export const Route = createFileRoute('/_authenticated/system/permissions/')({
  beforeLoad: ({ context }) => {
    if (!can(context.session.user, 'system:permissions:read'))
      throw redirect({ to: '/403' })
  },
  component: () => <SystemPage resource='permissions' />,
})
