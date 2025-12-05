import { ApiProperty } from '@nestjs/swagger'
import { IsEmail } from 'class-validator'

export class ResendVerificationRequestDto {
  @ApiProperty()
  @IsEmail()
  email: string
}
