import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { PaymentProviderUnavailableException } from './payment-provider-unavailable.exception'

describe('paymentProviderUnavailableException', () => {
  it('should create exception with correct error code', () => {
    const exception = new PaymentProviderUnavailableException()

    expect(exception.code).toBe(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE)
    expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
  })

  it('should have correct error message', () => {
    const exception = new PaymentProviderUnavailableException()

    expect(exception.message).toBe('支付供应商暂时不可用')
  })
})
