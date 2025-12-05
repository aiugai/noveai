import { HttpException, HttpStatus, Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import type { LoggerService } from '@nestjs/common'
import { ThrottleRedisService } from './throttle-redis.service'

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean
  /** 剩余请求次数 */
  remaining: number
  /** 重置时间（Unix 时间戳，毫秒） */
  resetTime: number
}

/**
 * 基于 Redis 的统一限流服务
 *
 * 核心功能：
 * - 使用 Redis 原子操作（INCR + PEXPIRE）实现限流计数
 * - 支持多实例部署的全局限流一致性
 * - Redis 不可用时抛出错误，确保安全性
 *
 * 使用场景：
 * - 认证限流（登录、注册、OAuth）
 * - 业务限流（邮件验证、Agent 申请）
 */
@Injectable()
export class BaseRateLimitService implements OnModuleDestroy {
  constructor(
    private readonly throttleRedis: ThrottleRedisService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  /**
   * 检查限流是否触发
   *
   * @param key - Redis key（如 'email-verify:user123'）
   * @param limit - 限流阈值（如 5）
   * @param windowMs - 时间窗口（毫秒，如 900000 = 15 分钟）
   * @returns RateLimitResult - 限流检查结果
   * @throws HttpException (SERVICE_UNAVAILABLE) - Redis 不可用时
   *
   * @example
   * ```typescript
   * const result = await rateLimitService.checkLimit('email-verify:user123', 5, 15 * 60 * 1000)
   * if (!result.allowed) {
   *   throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS)
   * }
   * ```
   */
  async checkLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const client = this.throttleRedis.getClient()

    // 检查 Redis 连接是否可用
    if (!client || !this.throttleRedis.isReady()) {
      const error = new Error('Redis client is not available for rate limiting')
      this.logger.error('Rate limit check failed: Redis not available', { error })
      throw new HttpException('Rate limiting service unavailable', HttpStatus.SERVICE_UNAVAILABLE)
    }

    try {
      // Redis 原子操作：自增计数器
      const count = await client.incr(key)

      // 获取当前 TTL
      const ttl = await client.pttl(key)

      // 如果是第一次访问或 key 失去了 TTL（-1 或 -2），设置/恢复过期时间
      // -1: key 存在但没有 TTL（可能由于进程崩溃或手动操作）
      // -2: key 不存在
      if (count === 1 || ttl <= 0) {
        await client.pexpire(key, windowMs)
      }

      // 重新获取 TTL 以计算准确的重置时间
      const updatedTtl = await client.pttl(key)
      const resetTime = Date.now() + (updatedTtl > 0 ? updatedTtl : windowMs)

      const allowed = count <= limit

      // 记录限流检查日志（debug 级别）
      if (typeof (this.logger as any).debug === 'function') {
        ;(this.logger as any).debug(
          JSON.stringify({
            event: 'rate_limit_check',
            key,
            count,
            limit,
            windowMs,
            allowed,
          }),
        )
      }

      // 如果超过限制，记录 warn 日志
      if (!allowed) {
        this.logger.warn(
          JSON.stringify({
            event: 'rate_limit_exceeded',
            key,
            count,
            limit,
            resetTime,
          }),
        )
      }

      return {
        allowed,
        remaining: Math.max(0, limit - count),
        resetTime,
      }
    } catch (error) {
      // Redis 操作失败
      this.logger.error('Redis rate limit operation failed', { error, key })
      throw new HttpException('Rate limiting service error', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  /**
   * 重置限流计数器（用于认证成功后清空）
   *
   * @param key - Redis key
   * @throws HttpException (SERVICE_UNAVAILABLE) - Redis 不可用时
   *
   * @example
   * ```typescript
   * // 认证成功后重置限流
   * await rateLimitService.resetLimit('auth:user123')
   * ```
   */
  async resetLimit(key: string): Promise<void> {
    const client = this.throttleRedis.getClient()

    if (!client || !this.throttleRedis.isReady()) {
      const error = new Error('Redis client is not available for rate limiting')
      this.logger.error('Rate limit reset failed: Redis not available', { error })
      throw new HttpException('Rate limiting service unavailable', HttpStatus.SERVICE_UNAVAILABLE)
    }

    try {
      // 删除限流计数器
      await client.del(key)

      // 记录重置日志
      this.logger.log(
        JSON.stringify({
          event: 'rate_limit_reset',
          key,
        }),
      )
    } catch (error) {
      this.logger.error('Redis rate limit reset failed', { error, key })
      throw new HttpException('Rate limiting service error', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  /**
   * 模块销毁时清理资源
   * 注意：Redis 连接由 ThrottleRedisService 管理，此处无需额外清理
   */
  onModuleDestroy(): void {
    this.logger.log('BaseRateLimitService destroyed')
  }
}
