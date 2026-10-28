import { toast } from 'sonner'
import { getApiErrorMessage, getErrorStatus } from '@/lib/api-client'

const GENERIC_ERROR_MESSAGE = '操作失败，请稍后重试。'
const NO_CONTENT_MESSAGE = '没有返回内容。'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = GENERIC_ERROR_MESSAGE

  if (getErrorStatus(error) === 204) {
    errMsg = NO_CONTENT_MESSAGE
  }

  const apiMessage = getApiErrorMessage(error)
  if (apiMessage) {
    errMsg = apiMessage
  }

  toast.error(errMsg)
}
