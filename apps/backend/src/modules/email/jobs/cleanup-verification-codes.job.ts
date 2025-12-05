import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { EmailService } from '../email.service'

@Injectable()
export class CleanupVerificationCodesJob {
  private readonly logger = new Logger(CleanupVerificationCodesJob.name)

  constructor(
    private readonly verificationCodeRepository: VerificationCodeRepository,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanup-verification-codes', timeZone: 'UTC' })
  async handleCleanup() {
    try {
      const result = await this.verificationCodeRepository.deleteExpiredCodes()
      this.logger.log(`Cleaned up ${result.count} expired verification codes`)
    } catch (error) {
      this.logger.error('Failed to clean up expired verification codes', error)
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'log-email-metrics', timeZone: 'UTC' })
  async logEmailMetrics() {
    const metrics = this.emailService.getEmailMetrics()
    this.logger.log(`Email metrics: ${JSON.stringify(metrics)}`)
  }
}
