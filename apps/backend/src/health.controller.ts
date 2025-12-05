import { Controller, Get } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { HealthCheckService, HealthCheck } from '@nestjs/terminus'
import { PrismaHealthIndicator, RedisHealthIndicator } from './common/health/indicators'
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger'
import { VersionService } from '@/common/services/version.service'
import { HealthCheckResponseDto } from '@/health/dto/health-check-response.dto'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly versionService: VersionService,
  ) {}

  @Get()
  @SkipThrottle()
  @Public()
  @ApiOperation({ summary: '健康检查（基本信息）' })
  @ApiOkResponse({
    description: '服务运行正常',
    type: HealthCheckResponseDto,
  })
  healthCheck(): HealthCheckResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      backendVersion: this.versionService.getBackendVersion(),
    }
  }

  @Get('liveness')
  @SkipThrottle()
  @Public()
  @ApiOperation({ summary: 'Liveness 探针（进程是否存活）' })
  @ApiOkResponse({
    description: '存活',
    schema: { example: { status: 'ok', timestamp: '2025-09-11T00:00:00.000Z' } },
  })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }

  @Get('readiness')
  @SkipThrottle()
  @Public()
  @HealthCheck()
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Readiness 探针（依赖是否就绪）' })
  @ApiOkResponse({ description: '就绪' })
  @ApiServiceUnavailableResponse({ description: '未就绪（依赖不可用）' })
  async readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ])
  }
}
