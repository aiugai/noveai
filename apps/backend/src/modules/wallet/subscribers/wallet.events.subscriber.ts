import { Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'

@Processor(MESSAGE_BUS_QUEUE)
export class WalletEventsSubscriber {
  private readonly logger = new Logger(WalletEventsSubscriber.name)
}
