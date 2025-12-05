import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 支付订单未找到异常
 *
 * @description
 * 当指定的支付订单ID不存在时抛出此异常
 *
 * @example
 * throw new PaymentOrderNotFoundException({ paymentOrderId: 'xxx' })
 */
export class PaymentOrderNotFoundException extends DomainException {
  constructor(args: { paymentOrderId: string }) {
    super('Payment order not found', {
      code: ErrorCode.PAYMENT_ORDER_NOT_FOUND,
      args,
      status: HttpStatus.NOT_FOUND,
    })
  }
}
