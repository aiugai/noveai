import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { PaymentMethod } from '@/modules/payment/enums/payment.method.enum'

export class SimulateRechargeRequestDto {
  @ApiProperty({ description: '需要模拟充值的用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '充值套餐 ID（必须为激活状态的套餐）' })
  @IsString()
  @IsNotEmpty()
  packageId!: string

  @ApiPropertyOptional({ description: '支付方式，默认 WECHAT', enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod

  @ApiPropertyOptional({ description: '入账资产代码，默认 SCORE' })
  @IsOptional()
  @IsString()
  targetAssetCode?: string

  @ApiPropertyOptional({ description: '是否模拟成功，默认 true' })
  @IsOptional()
  @IsBoolean()
  success?: boolean
}

