import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BasePaginationRequestDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'
import { UserStatus } from '@prisma/client'

export class AdminUserListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '邮箱或昵称关键字' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  keyword?: string

  @ApiPropertyOptional({ enum: UserStatus, description: '用户状态过滤' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus
}

export class AdminCreateUserDto {
  @ApiProperty({ description: '用户邮箱' })
  @IsEmail()
  email: string

  @ApiProperty({ description: '登录密码（至少6位）' })
  @IsString()
  @MinLength(6)
  password: string

  @ApiPropertyOptional({ description: '用户昵称' })
  @IsOptional()
  @IsString()
  nickname?: string | null

  @ApiPropertyOptional({ enum: UserStatus, description: '初始状态，默认启用' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ description: '用户邮箱' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ description: '用户昵称' })
  @IsOptional()
  @IsString()
  nickname?: string | null

  @ApiPropertyOptional({ enum: UserStatus, description: '账户状态' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus
}

export class AdminResetUserPasswordDto {
  @ApiProperty({ description: '新的登录密码（至少6位）' })
  @IsString()
  @MinLength(6)
  newPassword: string
}

export class AdminManagedUserDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  email: string

  @ApiPropertyOptional()
  nickname?: string | null

  @ApiProperty({ enum: UserStatus })
  status: UserStatus

  @ApiProperty()
  emailVerified: boolean

  @ApiProperty()
  isGuest: boolean

  @ApiProperty()
  guestRequiresBinding: boolean

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date

  @ApiPropertyOptional()
  deletedAt?: Date | null
}

export class AdminUserListResponseDto extends BasePaginationResponseDto<AdminManagedUserDto> {
  @ApiProperty({ type: AdminManagedUserDto, isArray: true })
  items: AdminManagedUserDto[]

  constructor(total: number, page: number, limit: number, items: AdminManagedUserDto[]) {
    super(total, page, limit, items)
    this.items = items
  }
}
