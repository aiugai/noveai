import { ExecutionContext, Inject, Injectable, LoggerService } from '@nestjs/common'
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  getOptionsToken,
  getStorageToken,
} from '@nestjs/throttler'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { Reflector } from '@nestjs/core'
import { getClientIp } from '../utils/ip.util'

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storage: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storage, reflector)
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 优先使用登录用户ID；否则回退到 X-Forwarded-For 或 req.ip
    const userId = req?.user?.id as string | undefined
    if (userId) return `user:${userId}`
    const ip = getClientIp(req)
    if (ip && ip !== 'unknown') return `ip:${ip}`
    // 回退到父类默认逻辑，避免所有未知来源落到同一桶
    return super.getTracker(req as any)
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: any): Promise<void> {
    try {
      const { req } = this.getRequestResponse(context)
      const payload = {
        event: 'throttle_block',
        userId: req?.user?.id,
        ip: getClientIp(req),
        path: req?.originalUrl || req?.url,
        requestId: req?.headers?.['x-request-id'] || (req as any)?.id,
        route: (req as any)?.route?.path,
        name: detail?.name || 'default',
        limit: detail?.limit,
        ttl: detail?.ttl,
      }
      ;(this.logger as any).warn(payload)
    } catch {}
    return super.throwThrottlingException(context, detail)
  }
}
