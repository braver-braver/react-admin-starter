import { setupWorker } from 'msw/browser'
import { attachContractGuard } from './contract-guard'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
// Development and demo builds report mock responses that break the contract.
attachContractGuard(worker)
