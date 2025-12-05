import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'

@Global()
@Module({
  imports: [],
  providers: [PrismaService, TransactionEventsService],
  exports: [PrismaService, TransactionEventsService],
})
export class PrismaModule {}
