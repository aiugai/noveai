import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { BasePaginationRequestDto, BaseResponseDto } from '@/common/dto/base.dto'
import { ErrorResponseDto } from '@/common/dto/error.response.dto'
import { RegisterRequestDto } from '@/modules/auth/dto/requests/register.request.dto'
import { LoginRequestDto } from '@/modules/auth/dto/requests/login.request.dto'
import { VerifyEmailRequestDto } from '@/modules/auth/dto/requests/verify-email.request.dto'
import { ResendVerificationRequestDto } from '@/modules/auth/dto/requests/resend-verification.request.dto'
import { PasswordResetRequestDto } from '@/modules/auth/dto/requests/password-reset.request.dto'
import { VerifyPasswordResetRequestDto } from '@/modules/auth/dto/requests/verify-password-reset.request.dto'
import { ChangePasswordRequestDto } from '@/modules/auth/dto/requests/change-password.request.dto'
import { AuthResponseDto } from '@/modules/auth/dto/responses/auth.response.dto'
import { UserProfileResponseDto } from '@/modules/user/dto/responses/user.profile.response.dto'
import { AdminAuthResponseDto } from '@/modules/admin/dto/admin-auth.dto'

const extraModels = [
  BasePaginationRequestDto,
  BasePaginationResponseDto,
  BaseResponseDto,
  ErrorResponseDto,
  RegisterRequestDto,
  LoginRequestDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  PasswordResetRequestDto,
  VerifyPasswordResetRequestDto,
  ChangePasswordRequestDto,
  AuthResponseDto,
  UserProfileResponseDto,
  AdminAuthResponseDto,
]

function buildConfig() {
  return new DocumentBuilder()
    .setTitle('AI Scaffold API')
    .setDescription('Auth / Admin / RBAC 基础脚手架')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
}

export function buildSwaggerDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, buildConfig(), { extraModels })
}

export function setupSwagger(app: INestApplication) {
  const document = buildSwaggerDocument(app)
  SwaggerModule.setup('docs', app, document)
  return document
}
