import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'

import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { CredentialType, VerificationCodePurpose } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'
import { EmailService } from '@/modules/email/email.service'
import { UserService } from '@/modules/user/user.service'
import { RegisterRequestDto } from './dto/requests/register.request.dto'
import { LoginRequestDto } from './dto/requests/login.request.dto'
import { AuthResponseDto } from './dto/responses/auth.response.dto'
import { VerifyEmailRequestDto } from './dto/requests/verify-email.request.dto'
import { ResendVerificationRequestDto } from './dto/requests/resend-verification.request.dto'
import { PasswordResetRequestDto } from './dto/requests/password-reset.request.dto'
import { VerifyPasswordResetRequestDto } from './dto/requests/verify-password-reset.request.dto'
import { ChangePasswordRequestDto } from './dto/requests/change-password.request.dto'
import { JwtPayload } from './interfaces/jwt-payload.interface'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly accessTtl: number

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {
    this.accessTtl = this.configService.get<number>('jwt.accessExpiration', 30 * 24 * 3600)
  }

  async register(dto: RegisterRequestDto): Promise<AuthResponseDto> {
    const existing = await this.userService.findByEmail(dto.email)
    if (existing) {
      throw new DomainException('Email already taken', { code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN, args: { email: dto.email } })
    }

    const hashed = await bcrypt.hash(dto.password, 10)
    const user = await this.userService.createUser({
      email: dto.email,
      password: hashed,
      nickname: dto.nickname,
    })

    await this.userService.upsertCredential(user.id, CredentialType.email, user.email)

    const code = await this.issueVerificationCode(user.email, VerificationCodePurpose.EMAIL_VERIFICATION)
    await this.emailService.sendVerificationEmail({ email: user.email, code, userName: user.nickname ?? user.email })

    return this.buildAuthResponse(user)
  }

  async login(dto: LoginRequestDto): Promise<AuthResponseDto> {
    const user = await this.userService.findByEmail(dto.email)
    if (!user) {
      throw new DomainException('Invalid email or password', { code: ErrorCode.AUTH_INVALID_CREDENTIALS })
    }

    const matched = await bcrypt.compare(dto.password, user.password)
    if (!matched) {
      throw new DomainException('Invalid email or password', { code: ErrorCode.AUTH_INVALID_CREDENTIALS })
    }

    return this.buildAuthResponse(user)
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND })
    }
    const matched = await bcrypt.compare(dto.currentPassword, user.password)
    if (!matched) {
      throw new DomainException('Current password is incorrect', { code: ErrorCode.AUTH_INVALID_CREDENTIALS })
    }
    const hashed = await bcrypt.hash(dto.newPassword, 10)
    await this.userService.updatePassword(user.id, hashed)
  }

  async verifyEmail(dto: VerifyEmailRequestDto): Promise<void> {
    await this.consumeVerificationCode(dto.email, dto.code, VerificationCodePurpose.EMAIL_VERIFICATION)
    const user = await this.userService.findByEmail(dto.email)
    if (user) {
      await this.userService.markEmailVerified(user.id)
    }
  }

  async resendVerification(dto: ResendVerificationRequestDto): Promise<void> {
    const user = await this.userService.findByEmail(dto.email)
    if (!user) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND })
    }
    if (user.emailVerified) {
      throw new DomainException('Email already verified', { code: ErrorCode.AUTH_EMAIL_ALREADY_VERIFIED })
    }
    const code = await this.issueVerificationCode(user.email, VerificationCodePurpose.EMAIL_VERIFICATION)
    await this.emailService.sendVerificationEmail({ email: user.email, code, userName: user.nickname ?? user.email })
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const user = await this.userService.findByEmail(dto.email)
    if (!user) {
      return
    }
    const code = await this.issueVerificationCode(user.email, VerificationCodePurpose.PASSWORD_RESET)
    await this.emailService.sendVerificationEmail({ email: user.email, code, userName: user.nickname ?? user.email })
  }

  async verifyPasswordReset(dto: VerifyPasswordResetRequestDto): Promise<void> {
    await this.consumeVerificationCode(dto.email, dto.code, VerificationCodePurpose.PASSWORD_RESET)
    const user = await this.userService.findByEmail(dto.email)
    if (!user) {
      throw new DomainException('User not found', { code: ErrorCode.USER_NOT_FOUND })
    }
    const hashed = await bcrypt.hash(dto.newPassword, 10)
    await this.userService.updatePassword(user.id, hashed)
  }

  private async issueVerificationCode(email: string, purpose: VerificationCodePurpose): Promise<string> {
    const code = randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await this.prisma.getClient().verificationCode.create({
      data: {
        email: email.toLowerCase(),
        code,
        purpose,
        expiresAt,
      },
    })

    return code
  }

  private async consumeVerificationCode(
    email: string,
    code: string,
    purpose: VerificationCodePurpose,
  ): Promise<void> {
    const now = new Date()
    const record = await this.prisma.getClient().verificationCode.findFirst({
      where: { email: email.toLowerCase(), code, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      throw new DomainException('Invalid verification code', { code: ErrorCode.AUTH_INVALID_VERIFICATION_CODE })
    }
    if (record.expiresAt.getTime() < now.getTime()) {
      throw new DomainException('Verification code expired', { code: ErrorCode.AUTH_VERIFICATION_CODE_EXPIRED })
    }

    await this.prisma.getClient().verificationCode.update({
      where: { id: record.id },
      data: { usedAt: now },
    })
  }

  private async buildAuthResponse(user: { id: string; email: string; nickname?: string | null; emailVerified: boolean; createdAt: Date }): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email }
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: `${this.accessTtl}s` })

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname || undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    }
  }
}
