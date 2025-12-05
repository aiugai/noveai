import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { randomInt } from 'node:crypto'
import { SendEmailDto } from './dto/requests/send-email.dto'
import { SendVerificationEmailDto } from './dto/requests/send-verification-email.dto'
import { EmailFailedException } from './exceptions/email-failed.exception'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private static resendInstance: Resend
  private resend: Resend
  private fromEmail: string
  private fromName: string
  private emailsSent = 0
  private emailsFailed = 0
  private readonly appEnv: string
  private readonly isTestEnvironment: boolean

  // 测试环境下存储邮件记录
  private testEmailStorage: Array<{
    to: string
    subject: string
    html: string
    text?: string
    timestamp: Date
  }> = []

  constructor(private readonly configService: ConfigService) {
    this.appEnv = this.configService.get<string>('app.appEnv', 'development')!
    this.isTestEnvironment =
      this.appEnv === 'test' ||
      this.appEnv === 'e2e' ||
      this.appEnv === 'development' ||
      this.appEnv === 'staging'

    // Use singleton pattern for Resend instance to improve performance
    if (!EmailService.resendInstance && !this.isTestEnvironment) {
      const apiKey = this.configService.get<string>('RESEND_API_KEY')
      if (!apiKey) {
        this.logger.warn('RESEND_API_KEY is not configured. Email service will not send emails.')
        // Use a dummy key to avoid the error, but emails won't be sent
        EmailService.resendInstance = new Resend('re_dummy_key')
      } else {
        EmailService.resendInstance = new Resend(apiKey)
      }
    }

    if (!this.isTestEnvironment) {
      this.resend = EmailService.resendInstance
    }

    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@example.com')
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'AI Platform')
  }

  async sendEmail(sendEmailDto: SendEmailDto): Promise<void> {
    const { to, subject, html, text } = sendEmailDto

    // 在测试环境下，不实际发送邮件，而是存储邮件信息
    if (this.isTestEnvironment) {
      this.testEmailStorage.push({
        to,
        subject,
        html,
        text,
        timestamp: new Date(),
      })

      this.logger.log(`[TEST MODE] Email stored (not sent): ${subject} to ${to}`)
      this.emailsSent++
      return
    }

    if (!this.configService.get<string>('RESEND_API_KEY')) {
      this.logger.warn(`Email not sent (no API key configured): ${subject} to ${to}`)
      return
    }

    try {
      this.logger.log(
        `Attempting to send email from: ${this.fromName} <${this.fromEmail}> to: ${to}`,
      )
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      })

      if (error) {
        // 降级日志：仅记录必要信息，避免泄露收件人/模板内容
        this.logger.error(
          `Resend API error: ${error?.message || 'unknown'} (${error?.name || 'Error'})`,
        )
        throw new EmailFailedException({
          recipient: to,
          reason: error.message || JSON.stringify(error),
        })
      }

      this.logger.log(`Email sent successfully: ${data?.id} to ${to}`)
      this.emailsSent++
    } catch (error: any) {
      // 降级日志：不打印 stack 与敏感上下文
      this.logger.error(`Failed to send email: ${error?.message || 'unknown error'}`)
      this.emailsFailed++
      throw new EmailFailedException({
        recipient: to,
        reason: error?.message || 'unknown error',
      })
    }
  }

  async sendVerificationEmail(dto: SendVerificationEmailDto): Promise<void> {
    const { email, code, userName } = dto
    // Sanitize userName to prevent HTML injection
    const sanitizedUserName = userName?.replace(/[<>]/g, '') || 'there'

    const subject = 'Verify your email address'
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${this.fromName}!</h2>
        <p>Hi ${sanitizedUserName},</p>
        <p>Thank you for registering. Please verify your email address by entering the following code:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <br>
        <p>Best regards,<br>${this.fromName} Team</p>
      </div>
    `

    const text = `
Welcome to ${this.fromName}!

Hi ${sanitizedUserName},

Thank you for registering. Please verify your email address by entering the following code:

${code}

This code will expire in 10 minutes.

If you didn't request this verification, please ignore this email.

Best regards,
${this.fromName} Team
    `

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    })
  }

  async sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<void> {
    // Sanitize userName to prevent HTML injection
    const sanitizedUserName = userName?.replace(/[<>]/g, '') || 'there'

    const subject = 'Reset your password'
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${sanitizedUserName},</p>
        <p>We received a request to reset your password. Enter the following code to proceed:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        <br>
        <p>Best regards,<br>${this.fromName} Team</p>
      </div>
    `

    const text = `
Password Reset Request

Hi ${sanitizedUserName},

We received a request to reset your password. Enter the following code to proceed:

${code}

This code will expire in 10 minutes.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
${this.fromName} Team
    `

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    })
  }

  generateVerificationCode(): string {
    if (this.isTestEnvironment) {
      const fixed = this.configService.get<string>('EMAIL_FIXED_CODE') || '123456'
      return fixed
    }
    // 其他环境：随机验证码
    return randomInt(100000, 1000000).toString().padStart(6, '0')
  }

  getEmailMetrics() {
    const total = this.emailsSent + this.emailsFailed
    const successRate = total > 0 ? (this.emailsSent / total) * 100 : 0

    return {
      sent: this.emailsSent,
      failed: this.emailsFailed,
      total,
      successRate: `${successRate.toFixed(2)}%`,
    }
  }

  /**
   * 测试环境下获取存储的邮件 (仅用于测试)
   */
  getTestEmails(): Array<{
    to: string
    subject: string
    html: string
    text?: string
    timestamp: Date
  }> {
    if (!this.isTestEnvironment) {
      throw new DomainException('getTestEmails() can only be used in test environment', {
        code: ErrorCode.EMAIL_TEST_ONLY,
        args: { method: 'getTestEmails' },
        status: HttpStatus.FORBIDDEN,
      })
    }
    return [...this.testEmailStorage]
  }

  /**
   * 测试环境下清空邮件存储 (仅用于测试)
   */
  clearTestEmails(): void {
    if (!this.isTestEnvironment) {
      throw new DomainException('clearTestEmails() can only be used in test environment', {
        code: ErrorCode.EMAIL_TEST_ONLY,
        args: { method: 'clearTestEmails' },
        status: HttpStatus.FORBIDDEN,
      })
    }
    this.testEmailStorage = []
  }

  /**
   * 测试环境下查找特定收件人的邮件 (仅用于测试)
   */
  findTestEmailByRecipient(email: string): Array<{
    to: string
    subject: string
    html: string
    text?: string
    timestamp: Date
  }> {
    if (!this.isTestEnvironment) {
      throw new DomainException('findTestEmailByRecipient() can only be used in test environment', {
        code: ErrorCode.EMAIL_TEST_ONLY,
        args: { method: 'findTestEmailByRecipient' },
        status: HttpStatus.FORBIDDEN,
      })
    }
    return this.testEmailStorage.filter(email_record => email_record.to === email)
  }

  /**
   * 从邮件内容中提取验证码 (仅用于测试)
   */
  extractVerificationCodeFromEmail(emailHtml: string): string | null {
    if (!this.isTestEnvironment) {
      throw new DomainException('extractVerificationCodeFromEmail() can only be used in test environment', {
        code: ErrorCode.EMAIL_TEST_ONLY,
        args: { method: 'extractVerificationCodeFromEmail' },
        status: HttpStatus.FORBIDDEN,
      })
    }

    // 从HTML中提取6位数验证码
    const codeMatch = emailHtml.match(/>(\d{6})</)
    return codeMatch ? codeMatch[1] : null
  }
}
