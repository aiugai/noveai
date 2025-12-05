import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { Transform } from 'class-transformer'
import { PaymentOrderSourceType, PaymentOrderStatus } from '@prisma/client'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class QueryPaymentOrdersRequestDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '用户ID（精确匹配）' })
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional({ description: '订单状态', enum: PaymentOrderStatus })
  @IsOptional()
  @IsEnum(PaymentOrderStatus)
  status?: PaymentOrderStatus

  @ApiPropertyOptional({ description: '支付渠道' })
  @IsOptional()
  @IsString()
  channel?: string

  @ApiPropertyOptional({ description: '开始时间（ISO 8601）' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  startTime?: string

  @ApiPropertyOptional({ description: '结束时间（ISO 8601）' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value?.trim())
  endTime?: string

  @ApiPropertyOptional({ description: '订单来源类型', enum: PaymentOrderSourceType })
  @IsOptional()
  @IsEnum(PaymentOrderSourceType)
  sourceType?: PaymentOrderSourceType
}

