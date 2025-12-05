import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsString, IsIn, Matches, MinLength } from 'class-validator'
import { SystemWalletID } from '@prisma/client'

export class AdjustSystemWalletDto {
  @ApiProperty({
    enum: SystemWalletID,
    example: SystemWalletID.SYSTEM_MARKETING,
    description: '系统钱包 ID',
  })
  @IsEnum(SystemWalletID, { message: '无效的系统钱包 ID' })
  walletId: SystemWalletID

  @ApiProperty({
    example: 'SCORE',
    enum: ['SCORE', 'DIAMOND'],
    description: '资产类型代码',
  })
  @IsString()
  @IsIn(['SCORE', 'DIAMOND'], { message: '资产类型必须是 SCORE 或 DIAMOND' })
  assetCode: string

  @ApiProperty({
    example: '1000.000000',
    description: '调整金额（正数，最多 6 位小数）',
    pattern: '^\\d+(\\.\\d{1,6})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,6})?$/, { message: '金额格式错误，必须是正数且最多 6 位小数' })
  amount: string

  @ApiProperty({
    enum: ['INCREASE', 'DECREASE'],
    example: 'INCREASE',
    description: '操作方向：增加或减少',
  })
  @IsIn(['INCREASE', 'DECREASE'], { message: '操作方向必须是 INCREASE 或 DECREASE' })
  direction: 'INCREASE' | 'DECREASE'

  @ApiProperty({
    example: '补充游客注册试用积分',
    minLength: 5,
    description: '调整原因（最少 5 个字符）',
  })
  @IsString()
  @MinLength(5, { message: '原因最少 5 个字符' })
  reason: string
}
