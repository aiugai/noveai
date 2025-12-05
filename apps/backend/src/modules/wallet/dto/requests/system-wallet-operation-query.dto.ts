import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsArray, IsEnum, IsDateString, IsString, IsIn } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.dto'
import { SystemWalletID } from '@prisma/client'
import { Type, Transform } from 'class-transformer'

export class SystemWalletOperationQueryDto extends BasePaginationRequestDto {
  @ApiProperty({
    required: false,
    isArray: true,
    enum: SystemWalletID,
    description: '筛选的钱包 ID 列表',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined
    return Array.isArray(value) ? value : [value]
  })
  @IsArray()
  @IsEnum(SystemWalletID, { each: true })
  @Type(() => String)
  walletIds?: SystemWalletID[]

  @ApiProperty({
    required: false,
    isArray: true,
    enum: ['SCORE', 'DIAMOND'],
    description: '筛选的资产类型列表',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined
    return Array.isArray(value) ? value : [value]
  })
  @IsArray()
  @IsIn(['SCORE', 'DIAMOND'], { each: true })
  @Type(() => String)
  assetCodes?: string[]

  @ApiProperty({
    required: false,
    enum: ['manual', 'auto', 'all'],
    description: '调整类型筛选',
    default: 'all',
  })
  @IsOptional()
  @IsIn(['manual', 'auto', 'all'])
  adjustmentType?: 'manual' | 'auto' | 'all'

  @ApiProperty({
    required: false,
    description: '开始时间（ISO 8601 格式）',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiProperty({
    required: false,
    description: '结束时间（ISO 8601 格式）',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiProperty({
    required: false,
    description: '操作员关键字（模糊匹配昵称或 ID）',
  })
  @IsOptional()
  @IsString()
  operatorKeyword?: string
}
