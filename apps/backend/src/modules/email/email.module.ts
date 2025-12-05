import { Module } from '@nestjs/common'
import { MessageBusModule } from '@/modules/message-bus/message-bus.module'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../prisma/prisma.module'
import { EmailService } from './email.service'
import { VerificationCodeRepository } from './repositories/verification-code.repository'
import { CleanupVerificationCodesJob } from './jobs/cleanup-verification-codes.job'

@Module({
  imports: [ConfigModule, PrismaModule, MessageBusModule],
  providers: [EmailService, VerificationCodeRepository, CleanupVerificationCodesJob],
  exports: [
    EmailService,
    VerificationCodeRepository,
    CleanupVerificationCodesJob, // 导出定时任务服务，供 SchedulerAdmin 使用
  ],
})
export class EmailModule {}
