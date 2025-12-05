import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'
import { BasePaginationResponseDto } from './base.pagination.response.dto'

export class BasePaginationRequestDto {
  @ApiProperty({
    description: '页码（从1开始）',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @ApiProperty({
    description: '每页数量（最大200）',
    example: 20,
    maximum: 200,
  })
  @Type(() => Number)
  @IsInt()
  @Max(200)
  limit: number = 20
}

// BasePaginationResponseDto已移至base.pagination.response.dto.ts文件
// 这里导出以保持向后兼容
export { BasePaginationResponseDto }

export class BaseResponseDto<T> {
  @ApiProperty({ description: '业务数据' })
  data: T

  @ApiProperty({ description: '响应消息' })
  message: string

  constructor(data: T, message: string) {
    this.data = data
    this.message = message
  }
}
