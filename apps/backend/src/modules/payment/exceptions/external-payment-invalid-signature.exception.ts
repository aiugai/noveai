import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 外部支付签名验证失败异常
 *
 * @description
 * 当外部商户请求的 HMAC-SHA256 签名验证失败时抛出此异常
 */
export class ExternalPaymentInvalidSignatureException extends DomainException {
  constructor(merchantId?: string) {
    super('External payment signature verification failed', {
      code: ErrorCode.EXTERNAL_PAYMENT_INVALID_SIGNATURE,
      status: HttpStatus.FORBIDDEN,
      args: merchantId ? { merchantId } : undefined,
    })
  }
}
