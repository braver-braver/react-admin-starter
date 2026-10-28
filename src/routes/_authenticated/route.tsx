import { createFileRoute } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { requireSession } from '@/features/auth/guard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => requireSession(location.href),
  component: AuthenticatedLayout,
})
