import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Redis as IORedis } from 'ioredis'
import { IOREDIS_CLIENT } from '../modules/throttle-redis.module'
import { timeoutGuard } from '@ai/shared'
import { EnvService } from '@/common/services/env.service'

@Injectable()
export class StartupHealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupHealthService.name)

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(IOREDIS_CLIENT) private readonly redisClient: IORedis | null,
    private readonly env: EnvService,
  ) {}

  async onApplicationBootstrap() {
    await this.assertRedisConnectivity()
  }

  private async assertRedisConnectivity() {
    // 读取配置，提供更明确的错误提示
    const url = this.config.get<string>('redis.url') || this.env.getString('REDIS_URL')
    const host = this.config.get<string>('redis.host', 'localhost')
    const port = this.config.get<number>('redis.port', 6379)

    const client = this.redisClient || null
    if (!client) {
      const msg = '未获取到 Redis 客户端，跳过 Redis 启动连通性校验。'
      if (this.shouldFailHard()) {
        this.logger.error(`${msg}（严格模式）`)
        throw new Error('Redis client not available at bootstrap')
      } else {
        this.logger.warn(msg)
        return
      }
    }

    try {
      const guard = timeoutGuard(3000, 'Redis ping 超时')
      await Promise.race([client.ping(), guard.promise])
      guard.cancel()
      try {
        this.logger.log(
          JSON.stringify({ event: 'startup_redis_ready', appEnv: this.config.get('app.appEnv') }),
        )
      } catch {}
    } catch (error) {
      const location = this.maskRedisLocation(url, host, port)
      const appEnv = this.config.get<string>('app.appEnv', 'development')
      const envEnabled = this.env.getBoolean('THROTTLE_REDIS_ENABLE')
      const cfgEnabled = this.config.get<boolean>('throttle.redisEnabled', false)
      const effectiveEnabled = envEnabled || cfgEnabled || Boolean(url)
      try {
        this.logger.error(
          JSON.stringify({
            event: 'startup_redis_error',
            location,
            appEnv,
            envEnabled,
            cfgEnabled,
            effectiveEnabled,
            message: (error as Error)?.message,
          }),
        )
      } catch {
        this.logger.error(
          `Redis 连接失败：无法连接到 ${location}。 原始错误：${(error as Error)?.message}`,
        )
      }
      if (this.shouldFailHard()) {
        throw error instanceof Error ? error : new Error(String(error))
      } else {
        try {
          this.logger.warn(
            JSON.stringify({ event: 'startup_redis_skip_non_strict', appEnv, effectiveEnabled }),
          )
        } catch {
          this.logger.warn('非严格模式下，跳过 Redis 启动失败并继续运行（可能影响部分功能）。')
        }
      }
    }
  }

  private shouldFailHard(): boolean {
    const strict = this.env.getBoolean('STARTUP_HEALTH_STRICT')
    const appEnv = this.config.get<string>('app.appEnv', 'development')
    return strict || appEnv === 'production'
  }

  private maskRedisLocation(url?: string, host?: string, port?: number): string {
    const raw = url && url.length > 0 ? url : `${host}:${port}`
    let location = raw
    try {
      const u = new URL(raw.startsWith('redis') ? raw : `redis://${raw}`)
      if (u.password) u.password = '****'
      location = u.toString()
    } catch {}
    return location
  }
}
