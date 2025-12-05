import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator'
import { AdminMenuType } from '@prisma/client'

export class CreateMenuDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string | null

  @ApiProperty({ enum: AdminMenuType })
  @IsEnum(AdminMenuType)
  type: AdminMenuType

  @ApiProperty()
  @IsString()
  title: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  code?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  path?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  i18nKey?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sort?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isShow?: boolean
}

export class UpdateMenuDto extends CreateMenuDto {}

export class AdminMenuResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty({ required: false })
  parentId?: string | null

  @ApiProperty({ enum: AdminMenuType })
  type: AdminMenuType

  @ApiProperty()
  title: string

  @ApiProperty({ required: false })
  code?: string | null

  @ApiProperty({ required: false })
  path?: string | null

  @ApiProperty({ required: false })
  icon?: string | null

  @ApiProperty({ required: false })
  i18nKey?: string | null

  @ApiProperty({ required: false })
  sort?: number | null

  @ApiProperty({ required: false })
  isShow?: boolean | null
}
