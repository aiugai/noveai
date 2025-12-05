import { EmailFailedException } from './email-failed.exception'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

describe('emailFailedException', () => {
  it('should create exception with correct error code and args', () => {
    const recipient = 'user@example.com'
    const reason = 'smtp_error'
    const exception = new EmailFailedException({ recipient, reason })

    expect(exception.code).toBe(ErrorCode.EMAIL_SEND_FAILED)
    expect(exception.args).toEqual({ recipient, reason })
    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })

  it('should have descriptive message', () => {
    const exception = new EmailFailedException()

    expect(exception.message).toBe('Failed to send email')
  })

  it('should work with partial parameters', () => {
    const exception = new EmailFailedException({ recipient: 'test@example.com' })

    expect(exception.code).toBe(ErrorCode.EMAIL_SEND_FAILED)
    expect(exception.args).toEqual({ recipient: 'test@example.com' })
  })
})
