import { Module } from '@nestjs/common'
import { WinstonModule } from 'nest-winston'
import { ThrottleRedisModule } from './throttle-redis.module'
import { BaseRateLimitService } from '../services/base-rate-limit.service'

/**
 * 基础限流模块
 *
 * 提供统一的 Redis 限流服务，供所有业务模块使用
 * - 导入 ThrottleRedisModule 以获取 Redis 连接
 * - 导入 WinstonModule 以提供日志服务
 * - 导出 BaseRateLimitService 供其他模块注入
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [BaseRateLimitModule],
 *   // ...
 * })
 * export class AuthModule {}
 * ```
 */
@Module({
  imports: [ThrottleRedisModule, WinstonModule],
  providers: [BaseRateLimitService],
  exports: [BaseRateLimitService],
})
export class BaseRateLimitModule {}
