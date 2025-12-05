import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  code: string

  @ApiProperty()
  @IsString()
  name: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  menuPermissions?: string[]
}

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  menuPermissions?: string[]
}

export class AdminRoleResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  code: string

  @ApiProperty()
  name: string

  @ApiProperty({ required: false })
  description?: string | null

  @ApiProperty({ type: [String], default: [] })
  menuPermissions: string[]
}
