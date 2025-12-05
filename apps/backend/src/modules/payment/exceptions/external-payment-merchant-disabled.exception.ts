import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 外部支付商户已禁用异常
 *
 * @description
 * 当外部商户在 Setting 表中被标记为 enabled: false 时抛出此异常
 */
export class ExternalPaymentMerchantDisabledException extends DomainException {
  constructor(merchantId: string) {
    super(`External payment merchant is disabled: ${merchantId}`, {
      code: ErrorCode.EXTERNAL_PAYMENT_MERCHANT_DISABLED,
      status: HttpStatus.FORBIDDEN,
      args: { merchantId },
    })
  }
}
