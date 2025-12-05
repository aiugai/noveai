import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 支付签名无效异常
 *
 * @description
 * 当商户请求的签名验证失败时抛出此异常
 * 使用 HMAC-SHA256 算法验证签名
 *
 * @example
 * throw new PaymentSignatureInvalidException()
 */
export class PaymentSignatureInvalidException extends DomainException {
  constructor() {
    super('Payment request signature is invalid', {
      code: ErrorCode.PAYMENT_SIGNATURE_INVALID,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
