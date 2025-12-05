import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AiProviderErrorException extends DomainException {
  constructor(providerCode: string, reason: string, detail?: string) {
    super('AI provider request failed', {
      code: ErrorCode.AI_PROVIDER_ERROR,
      args: {
        providerCode,
        reason,
        detail,
      },
    })
  }
}


