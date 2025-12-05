import { Injectable, Inject, Optional } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus'
import { PrismaService } from '@/prisma/prisma.service'
import type { Redis as IORedis } from 'ioredis'
import { IOREDIS_CLIENT } from '../modules/throttle-redis.module'
import { withTimeout } from '@ai/shared'

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async pingCheck(key = 'database', timeoutMs = 3000): Promise<HealthIndicatorResult> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ])
      return this.getStatus(key, true)
    } catch (error) {
      const result = this.getStatus(key, false, { error: (error as Error).message })
      throw new HealthCheckError('Prisma ping failed', result)
    }
  }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Optional() @Inject(IOREDIS_CLIENT) private readonly redis?: IORedis | null) {
    super()
  }

  async pingCheck(key = 'redis', timeoutMs = 3000): Promise<HealthIndicatorResult> {
    if (!this.redis) {
      return this.getStatus(key, true, { skipped: true })
    }
    try {
      await withTimeout(() => this.redis!.ping(), timeoutMs, 'timeout')
      return this.getStatus(key, true)
    } catch (error) {
      const result = this.getStatus(key, false, { error: (error as Error).message })
      throw new HealthCheckError('Redis ping failed', result)
    }
  }
}
