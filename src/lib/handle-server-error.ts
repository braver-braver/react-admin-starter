import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { t } from '@/lib/i18n'

export function handleServerError(error: unknown) {
  let errMsg = t('serverError')

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = t('noContent')
  }

  if (error instanceof ApiError) errMsg = error.message
  toast.error(errMsg)
}
