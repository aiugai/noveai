import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator'
import { PaymentMethod } from '../../enums/payment.method.enum'

export class CreatePaymentOrderRequestDto {
  @ApiProperty({
    description:
      'Payment amount（字符串；USD 场景仅允许固定套餐金额，且最多两位小数；其他币种需为有效正数）',
    example: '100.50',
  })
  @IsString()
  @Matches(/^(?!0+(?:\.0+)?$)\d+(?:\.\d+)?$/, { message: 'amount 必须为大于0的数字字符串' })
  amount: string

  @ApiProperty({
    description:
      'Payment currency (ISO 4217, 3 uppercase letters)。当前最小方案：若为 USD 且通道为 WGQPAY，后端将按设置汇率换算为 CNY 结算',
    example: 'CNY',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/)
  currency: string

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.WECHAT,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod

  @ApiPropertyOptional({
    description: 'Target asset code in the wallet after successful payment',
    example: 'DIAMOND',
  })
  @IsOptional()
  @IsString()
  targetAssetCode?: string

  @ApiPropertyOptional({ description: '充值套餐 ID（优先使用，缺省时按金额匹配）' })
  @IsOptional()
  @IsString()
  packageId?: string

}
