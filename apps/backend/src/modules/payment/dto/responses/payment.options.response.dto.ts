import { ApiProperty } from '@nestjs/swagger'
import { PaymentMethod } from '../../enums/payment.method.enum'
import { RechargePackageOptionDto } from './recharge-package-option.dto'

export class PaymentOptionsResponseDto {
  @ApiProperty({
    description: '当前支持的支付方式列表',
    enum: PaymentMethod,
    isArray: true,
  })
  methods!: PaymentMethod[]

  @ApiProperty({ description: '允许的目标资产代码列表', isArray: true, type: String })
  targetAssetCodes!: string[]

  @ApiProperty({ description: '结算货币（ISO 4217）', example: 'USD' })
  settlementCurrency!: string

  @ApiProperty({ description: '可用充值套餐列表', type: [RechargePackageOptionDto] })
  packages!: RechargePackageOptionDto[]

  @ApiProperty({ description: 'USD 转 CNY 汇率（用于展示），默认 7.2', example: 7.2 })
  exchangeRate!: number
}
