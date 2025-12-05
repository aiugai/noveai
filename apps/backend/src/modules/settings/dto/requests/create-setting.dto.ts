import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateSettingDto {
  @ApiProperty({ description: '配置键名', example: 'site.title' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: '配置值', example: 'My Site' })
  @IsNotEmpty()
  value: any;

  @ApiProperty({
    description: '值类型',
    example: 'string',
    enum: ['string', 'number', 'boolean', 'json'],
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: '配置描述', example: '网站标题' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '配置分类', example: 'site' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: '是否系统配置', example: false })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
