import { Inject, Injectable, OnApplicationShutdown, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis, { RedisOptions } from 'ioredis'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class ThrottleRedisService implements OnApplicationShutdown {
  private readonly client: Redis | null

  constructor(
    private readonly config: ConfigService,
    private readonly env: EnvService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {
    const appEnv = this.config.get<string>('app.appEnv', this.env.getAppEnv())
    // 统一从全局配置读取应用名，避免局部硬编码；允许 APP_NAME 兜底
    const appName =
      this.config.get<string>('app.appName') || this.env.getString('APP_NAME', '@ai/backend')
    // 将 appName slug 化，避免 Redis 工具/代理对特殊字符（如 @ 和 /）的兼容性问题
    const safeApp = (appName || 'app')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    const keyPrefix = `throttle:${safeApp}:${appEnv}::`

    const url = this.config.get<string>('redis.url') || this.env.getString('REDIS_URL')
    const enabledEnv = this.env.getBoolean('THROTTLE_REDIS_ENABLE')
    const enabledCfg = this.config.get<boolean>('throttle.redisEnabled', false)
    const isTestLike = appEnv === 'test' || appEnv === 'e2e'

    // 启用策略：显式打开（THROTTLE_REDIS_ENABLE / throttle.redisEnabled）或提供了 REDIS_URL
    // 测试环境严格：仅当显式 THROTTLE_REDIS_ENABLE=true 时启用，避免因 REDIS_URL 偶然注入造成连接
    const baseEnabled = enabledEnv || enabledCfg || Boolean(url)
    const enabled = isTestLike ? enabledEnv : baseEnabled

    if (url && enabled) {
      // 优先使用 REDIS_URL（支持 rediss:// TLS）
      this.client = new Redis(url, { keyPrefix })
    } else if (enabled && !isTestLike) {
      // 仅在显式启用且非 test/e2e 环境下使用分字段配置
      const host = this.config.get<string>('redis.host')
      const port = this.config.get<number>('redis.port')
      const passwordRaw = this.config.get<string | undefined>('redis.password')
      const password = passwordRaw && passwordRaw.length > 0 ? passwordRaw : undefined
      const db = this.config.get<number>('redis.db', 0)
      const useTLS = this.config.get<boolean>('redis.tls', false) || false

      if (host && port) {
        const options: RedisOptions = {
          host,
          port,
          password, // 未提供则为 undefined，避免错误的默认密码
          db,
          keyPrefix,
        }
        if (useTLS) (options as any).tls = {}
        if (!password && appEnv === 'production') {
          try {
            this.logger.warn(
              JSON.stringify({ event: 'throttle_redis_password_empty_in_production' }),
            )
          } catch {}
        }
        this.client = new Redis(options)
      } else {
        this.client = null
      }
    } else {
      // 未启用或测试环境：回退为内存存储（不创建 Redis 客户端）
      this.client = null
    }

    // 观测：记录连接状态
    if (this.client) {
      // 记录一次配置摘要，便于排障（保留原始 appName 与规范化后的 safeApp）
      try {
        const msg = JSON.stringify({
          event: 'throttle_redis_init',
          appName,
          safeApp,
          appEnv,
          keyPrefix,
        })
        // 生产环境降噪，仅输出 debug；非生产可按默认级别输出
        if (appEnv === 'production' && typeof (this.logger as any).debug === 'function') {
          ;(this.logger as any).debug(msg, 'ThrottleRedisService')
        } else {
          this.logger.log(msg, 'ThrottleRedisService')
        }
      } catch {}
      this.client.on('ready', () => {
        try {
          this.logger.log(JSON.stringify({ event: 'throttle_redis_ready' }))
        } catch {}
      })
      this.client.on('error', (err: any) => {
        try {
          this.logger.error(
            JSON.stringify({ event: 'throttle_redis_error', message: err?.message }),
          )
        } catch {}
      })
    } else if (enabled) {
      try {
        this.logger.warn(JSON.stringify({ event: 'throttle_redis_disabled_or_config_missing' }))
      } catch {}
    }
  }

  getClient(): Redis | null {
    return this.client
  }

  isReady(): boolean {
    // ioredis status: 'ready' when connected
    return this.client?.status === 'ready'
  }

  async onApplicationShutdown() {
    try {
      if (!this.client) return
      await this.client.quit()
    } catch {
      try {
        this.client?.disconnect()
      } catch {}
    }
  }
}
