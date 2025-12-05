import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MinLength, IsBoolean } from 'class-validator'

export class CreateAdminUserDto {
  @ApiProperty()
  @IsString()
  username: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickName?: string

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  roleIds?: string[]
}

export class UpdateAdminUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickName?: string | null

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  roleIds?: string[]

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFrozen?: boolean
}

export class ResetAdminPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword: string
}

export class AdminAssignedRoleDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  code: string

  @ApiProperty()
  name: string

  @ApiProperty({ required: false })
  description?: string | null
}

export class AdminUserResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  username: string

  @ApiProperty({ required: false })
  email?: string | null

  @ApiProperty({ required: false })
  nickName?: string | null

  @ApiProperty({ default: false })
  isFrozen: boolean

  @ApiProperty({ type: [AdminAssignedRoleDto], default: [] })
  roles: AdminAssignedRoleDto[]
}
