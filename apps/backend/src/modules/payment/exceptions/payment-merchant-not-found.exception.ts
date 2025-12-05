import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 商户未找到异常
 *
 * @description
 * 当指定的商户ID在配置中不存在或未配置密钥时抛出此异常
 *
 * @example
 * throw new PaymentMerchantNotFoundException({ merchantId: 'invalid_merchant' })
 */
export class PaymentMerchantNotFoundException extends DomainException {
  constructor(args: { merchantId: string }) {
    super('Merchant not found or not configured', {
      code: ErrorCode.PAYMENT_MERCHANT_NOT_FOUND,
      args,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
