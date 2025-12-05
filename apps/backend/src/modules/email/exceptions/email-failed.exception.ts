import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'

/**
 * 邮件发送失败异常
 *
 * @example
 * throw new EmailFailedException({ recipient: 'user@example.com', reason: 'smtp_error' })
 */
export class EmailFailedException extends DomainException {
  constructor(params?: { recipient?: string; reason?: string }) {
    super('Failed to send email', {
      code: ErrorCode.EMAIL_SEND_FAILED,
      args: params,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  }
}
