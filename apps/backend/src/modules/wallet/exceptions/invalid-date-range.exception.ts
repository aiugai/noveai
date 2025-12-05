import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

/**
 * 快照回填日期范围无效异常
 *
 * @description
 * 当快照回填操作的开始日期晚于结束日期时抛出此异常
 *
 * @example
 * throw new InvalidDateRangeException({
 *   startDate: '2025-01-20',
 *   endDate: '2025-01-15'
 * })
 */
export class InvalidDateRangeException extends DomainException {
  public readonly startDate: string
  public readonly endDate: string

  constructor(params: { startDate: string; endDate: string }) {
    super('Invalid snapshot backfill date range', {
      code: ErrorCode.WALLET_SNAPSHOT_INVALID_DATE_RANGE,
      args: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
      status: HttpStatus.BAD_REQUEST,
    })

    this.startDate = params.startDate
    this.endDate = params.endDate
  }
}

