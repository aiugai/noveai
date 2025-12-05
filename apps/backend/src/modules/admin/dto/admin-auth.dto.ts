import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class AdminRegisterDto {
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

export class AdminLoginDto {
  @ApiProperty()
  @IsString()
  username: string

  @ApiProperty()
  @IsString()
  password: string
}

export class AdminProfileDto {
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

  @ApiProperty({ type: [String], default: [] })
  menuPermissions: string[]
}

export class AdminAuthResponseDto {
  @ApiProperty()
  accessToken: string

  @ApiProperty({ type: () => AdminProfileDto })
  admin: AdminProfileDto
}

export class ChangeAdminPasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  @MinLength(6)
  currentPassword: string

  @ApiProperty({ description: '新密码' })
  @IsString()
  @MinLength(6)
  newPassword: string
}
