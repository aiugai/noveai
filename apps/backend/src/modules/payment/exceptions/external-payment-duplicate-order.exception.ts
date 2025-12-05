import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 外部支付订单号重复异常
 *
 * @description
 * 当外部商户提交的 businessOrderId 已存在时抛出此异常
 */
export class ExternalPaymentDuplicateOrderException extends DomainException {
  constructor(merchantId: string, businessOrderId: string) {
    super(`External payment order already exists: ${merchantId}/${businessOrderId}`, {
      code: ErrorCode.EXTERNAL_PAYMENT_DUPLICATE_ORDER,
      status: HttpStatus.CONFLICT,
      args: { merchantId, businessOrderId },
    })
  }
}
