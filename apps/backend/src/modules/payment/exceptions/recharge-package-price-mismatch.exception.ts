import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

/**
 * 充值套餐价格不匹配异常
 */
export class RechargePackagePriceMismatchException extends DomainException {
  constructor(args: { packagePrice: string; requestAmount: string }) {
    super('Package price mismatch', {
      code: ErrorCode.PAYMENT_RECHARGE_PACKAGE_PRICE_MISMATCH,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}

