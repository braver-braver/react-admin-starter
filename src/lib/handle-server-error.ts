import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'

export function handleServerError(error: unknown) {
  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof AxiosError) {
    const title = error.response?.data?.title
    if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  if (error instanceof ApiError) errMsg = error.message
  toast.error(errMsg)
}
