import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 外部支付商户不存在异常
 *
 * @description
 * 当外部商户 ID 在 Setting 表中不存在时抛出此异常
 */
export class ExternalPaymentMerchantNotFoundException extends DomainException {
  constructor(merchantId: string) {
    super(`External payment merchant not found: ${merchantId}`, {
      code: ErrorCode.EXTERNAL_PAYMENT_MERCHANT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args: { merchantId },
    })
  }
}
