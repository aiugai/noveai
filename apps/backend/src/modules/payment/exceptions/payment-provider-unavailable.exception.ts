import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 支付供应商不可用异常
 *
 * @description
 * 当支付供应商服务暂时不可用或连接失败时抛出此异常
 *
 * @example
 * throw new PaymentProviderUnavailableException()
 */
export class PaymentProviderUnavailableException extends DomainException {
  constructor() {
    super('Payment provider is temporarily unavailable', {
      code: ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
  }
}
