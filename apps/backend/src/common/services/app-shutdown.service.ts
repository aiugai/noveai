import { Injectable, Logger, OnApplicationShutdown, Inject } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import * as winston from 'winston'

@Injectable()
export class AppShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(AppShutdownService.name)

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}`)
    this.logger.log('Starting graceful shutdown...')

    try {
      // 清理Redis缓存连接
      this.logger.log('Closing Redis cache connections...')
      // 注意：某些缓存管理器可能没有reset方法，这里只是尝试清理
      try {
        if (this.cacheManager && 'store' in this.cacheManager) {
          const store = (this.cacheManager as any).store
          if (store && typeof store.client?.quit === 'function') {
            await store.client.quit()
          }
        }
      } catch (error) {
        this.logger.warn('Could not close cache connections gracefully:', error)
      }

      // 关闭Winston日志传输器
      this.logger.log('Closing Winston log transports...')
      const loggers = winston.loggers.loggers
      if (loggers) {
        for (const [_name, logger] of loggers) {
          if (logger && typeof logger.close === 'function') {
            logger.close()
          }
        }
      }

      // 等待一些时间确保所有清理完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      this.logger.log('Graceful shutdown completed')
    } catch (error) {
      this.logger.error('Error during shutdown:', error)
    }
  }
}
