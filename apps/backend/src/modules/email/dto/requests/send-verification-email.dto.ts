import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class SendVerificationEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  code: string

  @IsString()
  @IsOptional()
  userName?: string
}
