import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator'

export class UpdateSettingDto {
  @ApiProperty({ description: '配置值', example: 'New Value' })
  @IsNotEmpty()
  value: any

  @ApiPropertyOptional({
    description: '值类型',
    example: 'string',
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsString()
  @IsOptional()
  type?: string

  @ApiPropertyOptional({ description: '配置描述', example: '更新后的描述' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ description: '配置分类', example: 'general' })
  @IsString()
  @IsOptional()
  category?: string

  @ApiPropertyOptional({ description: '是否系统配置', example: false })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean
}
