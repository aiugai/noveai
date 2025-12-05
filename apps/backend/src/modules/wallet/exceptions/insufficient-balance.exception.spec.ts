import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { InsufficientBalanceException } from './insufficient-balance.exception'

describe('insufficientBalanceException', () => {
  it('should create exception with correct error code for available balance', () => {
    const exception = new InsufficientBalanceException({
      currentBalance: '5.00',
      requestedAmount: '10.00',
      isFromFreeze: false,
    })

    expect(exception.code).toBe(ErrorCode.WALLET_INSUFFICIENT_BALANCE)
    expect(exception.args).toEqual({
      balanceType: '可用余额',
      current: '5.00',
      required: '10.00',
    })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('should create exception with correct error code for frozen balance', () => {
    const exception = new InsufficientBalanceException({
      currentBalance: '3.00',
      requestedAmount: '8.00',
      isFromFreeze: true,
    })

    expect(exception.code).toBe(ErrorCode.WALLET_INSUFFICIENT_FROZEN_BALANCE)
    expect(exception.args).toEqual({
      balanceType: '冻结余额',
      current: '3.00',
      required: '8.00',
    })
  })

  it('should include correct message based on balance type', () => {
    const availableBalanceException = new InsufficientBalanceException({
      currentBalance: '1.00',
      requestedAmount: '2.00',
      isFromFreeze: false,
    })

    const frozenBalanceException = new InsufficientBalanceException({
      currentBalance: '1.00',
      requestedAmount: '2.00',
      isFromFreeze: true,
    })

    expect(availableBalanceException.message).toBe('可用余额不足')
    expect(frozenBalanceException.message).toBe('冻结余额不足')
  })
})
