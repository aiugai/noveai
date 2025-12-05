import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ClsService } from 'nestjs-cls'
import { PrismaService } from '@/prisma/prisma.service'
import { SystemWalletSnapshotService } from './system-wallet-snapshot.service'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

@Injectable()
export class SystemWalletSnapshotSchedulerService {
  private readonly logger = new Logger(SystemWalletSnapshotSchedulerService.name)

  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
    private readonly snapshotService: SystemWalletSnapshotService,
  ) {}

  /**
   * 每小时 UTC 整点执行快照任务
   */
  @Cron('0 * * * *', { name: 'system-wallet-snapshot', timeZone: 'UTC' })
  async handleHourlySnapshot(): Promise<void> {
    const startTime = Date.now()
    const targetTime = dayjs.utc().startOf('hour').toDate()
    const timestamp = targetTime.toISOString()

    try {
      this.logger.log(`Starting system wallet snapshot for time: ${timestamp}`)

      // 使用 CLS + 事务包裹（符合 Issue #465 规范）
      const count = await this.cls.run(async () => {
        return await this.prisma.runInTransaction(async () => {
          return await this.snapshotService.createHourlySnapshot(targetTime)
        })
      })

      const duration = Date.now() - startTime
      this.logger.log(
        `System wallet snapshot completed. Time: ${timestamp}, Records: ${count}, Duration: ${duration}ms`,
      )
    } catch (error) {
      this.logger.error(
        `System wallet snapshot failed for time ${timestamp}: ${error.message}`,
        error.stack,
      )
      // 可选：发送告警通知
      // TODO: 集成告警系统
    }
  }
}

