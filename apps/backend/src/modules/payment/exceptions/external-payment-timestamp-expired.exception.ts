import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 外部支付时间戳过期异常
 *
 * @description
 * 当外部商户请求的时间戳超出允许范围（± 5 分钟）时抛出此异常
 */
export class ExternalPaymentTimestampExpiredException extends DomainException {
  constructor(args?: { timestamp: number, serverTime: number }) {
    super('External payment request timestamp expired', {
      code: ErrorCode.EXTERNAL_PAYMENT_TIMESTAMP_EXPIRED,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}
