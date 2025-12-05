import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'
import { Type } from 'class-transformer'
import { SystemWalletID } from '@prisma/client'
import { AssetCode, SnapshotGroupBy } from '@ai/shared'

/**
 * 自定义验证器：根据 groupBy 参数动态校验 timeRange 上限
 * - hour: 最大 168 小时（7 天）
 * - day: 最大 365 天（保持原有能力）
 */
function IsValidTimeRange(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidTimeRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as GetSnapshotTrendDto
          const groupBy = dto.groupBy || SnapshotGroupBy.Day

          if (typeof value !== 'number') {
            return false
          }

          if (value < 1) {
            return false
          }

          // 根据粒度应用不同的上限
          if (groupBy === SnapshotGroupBy.Hour) {
            return value <= 168 // 最多 7 天（168 小时）
          } else {
            return value <= 365 // 保持原有 365 天上限
          }
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as GetSnapshotTrendDto
          const groupBy = dto.groupBy || SnapshotGroupBy.Day

          if (groupBy === SnapshotGroupBy.Hour) {
            return 'timeRange must not be greater than 168 when groupBy is hour'
          } else {
            return 'timeRange must not be greater than 365 when groupBy is day'
          }
        },
      },
    })
  }
}

export class GetSnapshotTrendDto {
  @ApiPropertyOptional({
    description: '分组粒度（hour=按小时, day=按天）',
    enum: SnapshotGroupBy,
    default: SnapshotGroupBy.Day,
  })
  @IsOptional()
  @IsEnum(SnapshotGroupBy)
  groupBy?: SnapshotGroupBy = SnapshotGroupBy.Day

  @ApiPropertyOptional({
    description: '时间跨度（hour=最近N小时, day=最近N天）',
    default: 30,
    minimum: 1,
    maximum: 365,
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @IsValidTimeRange()
  @Type(() => Number)
  timeRange?: number = 30

  @ApiPropertyOptional({
    description: '系统钱包ID（SystemWalletID 枚举值）',
    example: 'SYSTEM_AI_REVENUE',
    enum: SystemWalletID,
  })
  @IsOptional()
  @IsEnum(SystemWalletID)
  walletId?: SystemWalletID

  @ApiPropertyOptional({
    description: '资产代码',
    example: 'DIAMOND',
    enum: AssetCode,
  })
  @IsOptional()
  @IsEnum(AssetCode)
  assetCode?: AssetCode
}

export class BackfillSnapshotsDto {
  @ApiProperty({
    description: '开始日期（YYYY-MM-DD）',
    example: '2025-01-01',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式必须为 YYYY-MM-DD',
  })
  startDate: string

  @ApiProperty({
    description: '结束日期（YYYY-MM-DD）',
    example: '2025-01-31',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日期格式必须为 YYYY-MM-DD',
  })
  endDate: string
}
