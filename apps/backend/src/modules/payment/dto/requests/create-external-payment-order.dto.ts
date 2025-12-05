import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsNumber,
  IsUrl,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator'

/**
 * 创建外部支付订单请求 DTO
 *
 * @description
 * 用于外部商户模式下创建支付订单
 * - 用户在 /recharge 页面选择套餐后提交
 * - 使用 HMAC-SHA256 签名验证商户身份
 * - 时间戳用于防重放攻击（± 5 分钟）
 *
 * 安全设计：
 * - 商户签名参数：merchantId, businessOrderId, retUrl, extraData, timestamp
 * - 用户选择参数：packageId（后端从数据库获取价格，防止篡改）
 * - 金额由后端根据 packageId 从数据库获取，不由前端传递
 */
export class CreateExternalPaymentOrderDto {
  // ========== 商户签名参数（来自 URL query，参与签名验证）==========

  @ApiProperty({
    description: '商户标识（来自 URL 参数）',
    example: 'merchant_001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchantId!: string

  @ApiProperty({
    description: '商户业务订单ID（来自 URL 参数，用于商户侧幂等）',
    example: 'BIZ202512020001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessOrderId!: string

  @ApiProperty({
    description: '支付成功后跳转地址（来自 URL 参数）',
    example: 'https://merchant.com/success',
  })
  // 允许本地开发环境使用 http://localhost:3000 这类无顶级域名的回调地址
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  @MaxLength(500)
  retUrl!: string

  @ApiPropertyOptional({
    description: '商户自定义数据（来自 URL 参数，JSON 字符串）',
    example: '{"user_id":"123"}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extraData?: string

  @ApiProperty({
    description: '请求时间戳（来自 URL 参数，秒级）',
    example: 1733097600,
  })
  @IsNumber()
  timestamp!: number

  @ApiProperty({
    description: 'HMAC-SHA256 签名（来自 URL 参数）',
    example: 'abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  sign!: string

  // ========== 用户选择参数（用户在页面选择，不参与商户签名）==========

  @ApiProperty({
    description: '用户选择的充值套餐 ID（后端从数据库获取价格）',
    example: 'pkg_starter_100',
  })
  @IsString()
  @IsNotEmpty()
  packageId!: string
}
