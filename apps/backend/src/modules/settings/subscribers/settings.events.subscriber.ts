import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { MessageEnvelope, MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { TOPIC_SETTINGS_EVENTS } from '@/modules/message-bus/message-bus.topics'

@Processor(MESSAGE_BUS_QUEUE)
export class SettingsEventsSubscriber {
  private readonly logger = new Logger(SettingsEventsSubscriber.name)

  @Process(TOPIC_SETTINGS_EVENTS)
  async handle(job: Job<MessageEnvelope<unknown>>): Promise<void> {
    const payload = job.data
    const correlationId = payload.meta?.correlationId
    try {
      this.logger.log(
        `Consumed topic='${payload.topic}', type='${payload.type}', jobId='${job.id}', correlationId='${correlationId ?? ''}'`,
      )
    } catch (err) {
      this.logger.error(
        `Failed topic='${payload.topic}', type='${payload.type}', jobId='${job.id}': ${String(err)}`,
      )
      throw err
    }
  }
}
