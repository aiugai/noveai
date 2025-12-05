import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'

// WGQPay 回调状态：0 待处理；1 成功；2 失败
export enum WGQPayStateEnum {
  PENDING = 0,
  SUCCESS = 1,
  FAILED = 2,
}

export class WGQPayCallbackDto {
  @ApiProperty({ description: '商户号', example: 'M123456' })
  @IsString()
  @IsNotEmpty()
  merchant_no!: string

  @ApiProperty({ description: '商户唯一订单号（我方订单ID）', example: 'abc123' })
  @IsString()
  @IsNotEmpty()
  merchant_order_id!: string

  @ApiProperty({ description: '平台唯一订单号', example: 'P987654' })
  @IsString()
  @IsNotEmpty()
  platform_order_id!: string

  @ApiProperty({ description: '时间戳（毫秒）', example: '1730192844000' })
  @IsString()
  @IsNotEmpty()
  timestamp!: string

  @ApiPropertyOptional({ description: '交易备注', example: 'foo' })
  @IsOptional()
  @IsString()
  attach?: string

  @ApiProperty({ description: '订单状态（0待处理 1成功 2失败）', example: 1 })
  @IsEnum(WGQPayStateEnum)
  @Type(() => Number)
  state!: WGQPayStateEnum

  @ApiProperty({ description: '下单金额', example: 10 })
  @IsNumber()
  @Type(() => Number)
  amount!: number

  @ApiProperty({ description: '实际支付金额', example: 10 })
  @IsNumber()
  @Type(() => Number)
  pay_amount!: number

  @ApiProperty({ description: '状态码', example: 200 })
  @IsNumber()
  @Type(() => Number)
  code!: number

  @ApiProperty({ description: '描述', example: 'success' })
  @IsString()
  @IsNotEmpty()
  message!: string

  @ApiProperty({ description: '签名（MD5）', example: 'cdb3b8...' })
  @IsString()
  @IsNotEmpty()
  sign!: string
}
