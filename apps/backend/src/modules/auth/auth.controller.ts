import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Public } from './decorators/public.decorator'
import { AuthService } from './auth.service'
import { RegisterRequestDto } from './dto/requests/register.request.dto'
import { LoginRequestDto } from './dto/requests/login.request.dto'
import { AuthResponseDto } from './dto/responses/auth.response.dto'
import { VerifyEmailRequestDto } from './dto/requests/verify-email.request.dto'
import { ResendVerificationRequestDto } from './dto/requests/resend-verification.request.dto'
import { PasswordResetRequestDto } from './dto/requests/password-reset.request.dto'
import { VerifyPasswordResetRequestDto } from './dto/requests/verify-password-reset.request.dto'
import { JwtAuthGuard } from './guards/jwt.auth.guard'
import { CurrentUser } from './decorators/current.user.decorator'
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto'

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '邮箱注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterRequestDto): Promise<AuthResponseDto> {
    return this.authService.register(dto)
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '邮箱登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginRequestDto): Promise<AuthResponseDto> {
    return this.authService.login(dto)
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证邮箱验证码' })
  verifyEmail(@Body() dto: VerifyEmailRequestDto): Promise<void> {
    return this.authService.verifyEmail(dto)
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重发邮箱验证码' })
  resendVerification(@Body() dto: ResendVerificationRequestDto): Promise<void> {
    return this.authService.resendVerification(dto)
  }

  @Post('password/reset-request')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '请求重置密码验证码' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    return this.authService.requestPasswordReset(dto)
  }

  @Post('password/reset-verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证验证码并重置密码' })
  verifyPasswordReset(@Body() dto: VerifyPasswordResetRequestDto): Promise<void> {
    return this.authService.verifyPasswordReset(dto)
  }

  @Post('password/change')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码（需登录）' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<void> {
    return this.authService.changePassword(userId, dto)
  }

}
