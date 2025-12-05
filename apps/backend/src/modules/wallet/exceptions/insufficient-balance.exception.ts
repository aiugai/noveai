import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 余额不足异常
 *
 * @description
 * 当钱包余额(可用余额或冻结余额)不足以完成操作时抛出此异常
 *
 * @example
 * throw new InsufficientBalanceException({
 *   currentBalance: '5.00',
 *   requestedAmount: '10.00',
 *   isFromFreeze: false
 * })
 */
export class InsufficientBalanceException extends DomainException {
  public readonly currentBalance: string
  public readonly requestedAmount: string
  public readonly isFromFreeze: boolean

  constructor(params: { currentBalance: string; requestedAmount: string; isFromFreeze: boolean }) {
    const balanceType = params.isFromFreeze ? '冻结余额' : '可用余额'
    const errorCode = params.isFromFreeze
      ? ErrorCode.WALLET_INSUFFICIENT_FROZEN_BALANCE
      : ErrorCode.WALLET_INSUFFICIENT_BALANCE

    super(`${balanceType}不足`, {
      code: errorCode,
      args: {
        balanceType,
        current: params.currentBalance,
        required: params.requestedAmount,
      },
      status: HttpStatus.BAD_REQUEST,
    })

    this.currentBalance = params.currentBalance
    this.requestedAmount = params.requestedAmount
    this.isFromFreeze = params.isFromFreeze
  }
}
