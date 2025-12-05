import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MessageBusModule } from '@/modules/message-bus/message-bus.module'
import { BullModule } from '@nestjs/bull'
import { MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { PaymentService } from './services/payment.service'
import { PaymentController } from './payment.controller'
import { PaymentOrderRepository } from './repositories/payment.order.repository'
import { PrismaModule } from '@/prisma/prisma.module'
import { WalletModule } from '@/modules/wallet/wallet.module'
import { MockPaymentProvider } from './providers/mock.payment.provider'
import { WGQPayProvider } from './providers/wgqpay.payment.provider'
import { PaymentEventsSubscriber } from './subscribers/payment.events.subscriber'
import { HttpClientModule } from '@/common/http/http-client.module'
import { SettingsModule } from '@/modules/settings/settings.module'
import { PaymentSettingsResolver } from './services/payment.settings.resolver'
import { CacheModule as AppCacheModule } from '@/cache/cache.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { RechargePackageRepository } from './repositories/recharge-package.repository'
import { RechargePackageService } from './services/recharge-package.service'
import { AdminPaymentController } from './admin.payment.controller'
import { PaymentExternalService } from './services/payment-external.service'
import { PaymentMerchantService } from './services/payment-merchant.service'
import { PaymentCallbackService } from './services/payment-callback.service'
import { PaymentCallbackProcessor } from './processors/payment-callback.processor'
import { PAYMENT_CALLBACK_QUEUE } from './constants/callback.constants'
import { PaymentPendingCheckerService } from './services/payment-pending-checker.service'
import { SignatureUtil } from './utils/signature.util'

@Module({
  imports: [
    PrismaModule,
    HttpClientModule,
    AppCacheModule,
    SettingsModule,
    AuthModule,
    JwtModule.register({}),
    forwardRef(() => WalletModule),
    MessageBusModule,
    BullModule.registerQueue({ name: MESSAGE_BUS_QUEUE }),
    BullModule.registerQueue({ name: PAYMENT_CALLBACK_QUEUE }),
  ],
  controllers: [
    PaymentController,
    AdminPaymentController,
  ],
  providers: [
    PaymentService,
    PaymentOrderRepository,
    RechargePackageRepository,
    RechargePackageService,
    MockPaymentProvider,
    WGQPayProvider,
    PaymentEventsSubscriber,
    PaymentSettingsResolver,
    PaymentExternalService,
    PaymentMerchantService,
    PaymentCallbackService,
    PaymentCallbackProcessor,
    PaymentPendingCheckerService,
    SignatureUtil,
  ],
  exports: [
    PaymentService,
    RechargePackageRepository,
    RechargePackageService,
    PaymentExternalService,
    PaymentMerchantService,
    PaymentCallbackService,
    SignatureUtil,
  ],
})
export class PaymentModule {}
