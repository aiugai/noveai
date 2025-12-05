import { ApiPropertyOptional } from '@nestjs/swagger'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import { IsEnum, IsOptional } from 'class-validator'
import { RechargePackageStatus } from '@prisma/client'

export class AdminQueryRechargePackagesDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '按状态过滤',
    enum: RechargePackageStatus,
    example: RechargePackageStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RechargePackageStatus)
  status?: RechargePackageStatus
}
