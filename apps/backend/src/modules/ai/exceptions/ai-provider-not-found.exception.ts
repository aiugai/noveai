import { ErrorCode } from '@ai/shared'

import { DomainException } from '@/common/exceptions/domain.exception'

export class AiProviderNotFoundException extends DomainException {
  constructor(providerCode: string) {
    super('AI provider not found', {
      code: ErrorCode.AI_PROVIDER_NOT_FOUND,
      args: { providerCode },
    })
  }
}


