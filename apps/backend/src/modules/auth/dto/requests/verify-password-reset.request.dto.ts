import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, Length, MinLength } from 'class-validator'

export class VerifyPasswordResetRequestDto {
  @ApiProperty()
  @IsEmail()
  email: string

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword: string
}
