import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 支付订单已处理异常
 *
 * @description
 * 当尝试处理一个已经处理过的订单时抛出此异常
 * 用于保证幂等性
 *
 * @example
 * throw new PaymentOrderAlreadyProcessedException({
 *   paymentOrderId: 'xxx',
 *   status: 'COMPLETED'
 * })
 */
export class PaymentOrderAlreadyProcessedException extends DomainException {
  constructor(args: { paymentOrderId: string; status: string }) {
    super('Payment order has already been processed', {
      code: ErrorCode.PAYMENT_ORDER_ALREADY_PROCESSED,
      args,
      status: HttpStatus.CONFLICT,
    })
  }
}
