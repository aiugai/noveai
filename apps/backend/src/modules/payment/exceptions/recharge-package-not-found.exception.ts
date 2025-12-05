import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

/**
 * 充值套餐不存在或已停用异常
 */
export class RechargePackageNotFoundException extends DomainException {
  constructor(args?: { packageId?: string; amount?: string }) {
    super('Recharge package not found or inactive', {
      code: ErrorCode.PAYMENT_RECHARGE_PACKAGE_NOT_FOUND,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }
}

