import { Module } from '@nestjs/common'

import { PrismaModule } from '@/prisma/prisma.module'
import { PaymentModule } from '@/modules/payment/payment.module'
import { EnvModule } from '@/common/modules/env.module'

import { PaymentOrdersController } from './payment-orders.controller'
import { PaymentOrdersService } from './payment-orders.service'

@Module({
  imports: [PrismaModule, PaymentModule, EnvModule],
  controllers: [PaymentOrdersController],
  providers: [PaymentOrdersService],
  exports: [PaymentOrdersService],
})
export class PaymentOrdersModule {}

