import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

/**
 * 充值套餐货币不匹配异常
 */
export class RechargePackageCurrencyMismatchException extends DomainException {
  constructor(args: { packageCurrency: string; requestCurrency: string }) {
    super('Package currency mismatch', {
      code: ErrorCode.PAYMENT_RECHARGE_PACKAGE_CURRENCY_MISMATCH,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}

