import { HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { InvalidDateRangeException } from './invalid-date-range.exception'

describe('invalidDateRangeException', () => {
  it('should create exception with correct error code and args', () => {
    const exception = new InvalidDateRangeException({
      startDate: '2025-01-20',
      endDate: '2025-01-15',
    })

    expect(exception.code).toBe(ErrorCode.WALLET_SNAPSHOT_INVALID_DATE_RANGE)
    expect(exception.args).toEqual({
      startDate: '2025-01-20',
      endDate: '2025-01-15',
    })
    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST)
    expect(exception.message).toBe('快照回填日期范围无效')
  })

  it('should expose startDate and endDate properties', () => {
    const exception = new InvalidDateRangeException({
      startDate: '2025-01-20',
      endDate: '2025-01-15',
    })

    expect(exception.startDate).toBe('2025-01-20')
    expect(exception.endDate).toBe('2025-01-15')
  })
})

