import { ApiPropertyOptional } from '@nestjs/swagger'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import { IsDate, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator'
import { Type } from 'class-transformer'
import { PaymentOrderSourceType, PaymentOrderStatus } from '@prisma/client'
import { PaymentChannel } from '../../enums/payment.channel.enum'

export class AdminListPaymentOrdersRequestDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '用户 ID（CUID）',
    example: 'ckv123example456',
  })
  @IsOptional()
  @IsString()
  @Length(10, 32)
  userId?: string

  @ApiPropertyOptional({
    description: '支付订单状态',
    enum: PaymentOrderStatus,
    example: PaymentOrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentOrderStatus)
  status?: PaymentOrderStatus

  @ApiPropertyOptional({
    description: '支付渠道',
    enum: PaymentChannel,
    example: PaymentChannel.WGQPAY,
  })
  @IsOptional()
  @IsEnum(PaymentChannel)
  channel?: PaymentChannel

  @ApiPropertyOptional({
    description: '创建时间起始（ISO 8601）',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date

  @ApiPropertyOptional({
    description: '创建时间结束（ISO 8601）',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date

  @ApiPropertyOptional({
    description: '外部订单号（用于精准搜索）',
    example: 'trxn_1234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w\-:.]+$/, { message: '外部订单号只允许字母、数字与符号 -_:.' })
  externalOrderId?: string

  @ApiPropertyOptional({
    description: '外部商户 ID（用于筛选外部支付中心订单）',
    example: 'merchant_wallet',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  merchantId?: string

  @ApiPropertyOptional({
    description: '业务订单号（外部商户的订单号）',
    example: 'biz_order_123',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  businessOrderId?: string

  @ApiPropertyOptional({
    description: '订单来源类型',
    enum: PaymentOrderSourceType,
    example: PaymentOrderSourceType.EXTERNAL,
  })
  @IsOptional()
  @IsEnum(PaymentOrderSourceType)
  sourceType?: PaymentOrderSourceType
}
