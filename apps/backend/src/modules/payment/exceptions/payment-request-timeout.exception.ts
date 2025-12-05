import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 支付请求超时异常
 *
 * @description
 * 当请求时间戳超出允许的时效性窗口(5分钟)时抛出此异常
 * 用于防止重放攻击
 *
 * @example
 * throw new PaymentRequestTimeoutException({ timestamp: 1234567890, serverTime: 1234567899 })
 */
export class PaymentRequestTimeoutException extends DomainException {
  constructor(args?: { timestamp: number; serverTime: number }) {
    super('Payment request has expired', {
      code: ErrorCode.PAYMENT_REQUEST_TIMEOUT,
      args,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
