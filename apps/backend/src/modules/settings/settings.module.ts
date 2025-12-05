import { Module, forwardRef } from '@nestjs/common'
import { MessageBusModule } from '@/modules/message-bus/message-bus.module'
import { SettingsService } from './services/settings.service'
import { SettingsRepository } from './repositories/settings.repository'
import { AdminSettingsController } from './controllers/admin.settings.controller'
import { PrismaModule } from '@/prisma/prisma.module'
import { CacheModule } from '@/cache/cache.module'
import { AdminAuthModule } from '@/modules/auth/admin/admin-auth.module'
import { SettingsEventsSubscriber } from './subscribers/settings.events.subscriber'

@Module({
  imports: [PrismaModule, CacheModule, forwardRef(() => AdminAuthModule), MessageBusModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService, SettingsRepository, SettingsEventsSubscriber],
  exports: [SettingsService],
})
export class SettingsModule {}
