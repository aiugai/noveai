import { Module, forwardRef } from '@nestjs/common'
import { MessageBusModule } from '@/modules/message-bus/message-bus.module'
import { BullModule } from '@nestjs/bull'
import { MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { WalletController } from './wallet.controller'
import { WalletService } from './wallet.service'
import { WalletRepository } from './repositories/wallet.repository'
import { ChatTransactionAggregationService } from './services/chat-transaction-aggregation.service'
import { WalletStatisticsService } from './services/wallet-statistics.service'
import { SystemWalletAdminService } from './services/system-wallet-admin.service'
import { SystemWalletSnapshotService } from './services/system-wallet-snapshot.service'
import { SystemWalletSnapshotSchedulerService } from './services/system-wallet-snapshot-scheduler.service'
import { PrismaModule } from '../../prisma/prisma.module'
import { AdminWalletController } from './admin.wallet.controller'
import { SettingsModule } from '../settings/settings.module'
import { ConfigModule } from '@nestjs/config'
import { WalletEventsSubscriber } from './subscribers/wallet.events.subscriber'
import { WalletPaymentWithdrawSubscriber } from './subscribers/payment.withdraw.subscriber'
import { AiUsageBillingSubscriber } from './subscribers/ai-usage-billing.subscriber'
import { CacheModule } from '@/cache/cache.module'
import { AuditModule } from '../admin/audit/audit.module'

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SettingsModule),
    ConfigModule,
    MessageBusModule,
    // 确保本模块内注册了队列，处理器才能正确挂载
    BullModule.registerQueue({ name: MESSAGE_BUS_QUEUE }),
    CacheModule,
    AuditModule,
  ],
  controllers: [WalletController, AdminWalletController],
  providers: [
    WalletService,
    WalletRepository,
    ChatTransactionAggregationService,
    WalletStatisticsService,
    SystemWalletAdminService,
    SystemWalletSnapshotService,
    SystemWalletSnapshotSchedulerService,
    WalletEventsSubscriber,
    WalletPaymentWithdrawSubscriber,
    AiUsageBillingSubscriber,
  ],
  exports: [
    WalletService,
    ChatTransactionAggregationService,
    SystemWalletAdminService,
    SystemWalletSnapshotSchedulerService, // 导出定时任务服务，供 SchedulerAdmin 使用
  ],
})
export class WalletModule {}
