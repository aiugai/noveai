import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import * as redisStore from 'cache-manager-ioredis'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'
import { TerminusModule } from '@nestjs/terminus'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { WinstonModule } from 'nest-winston'
import { ClsMiddleware } from 'nestjs-cls'

import { PrismaModule } from './prisma/prisma.module'
import { loggerConfig, createWinstonTransports } from './config/logger.config'
import { CacheModule } from './cache/cache.module'
import { ClsConfigModule } from './common/modules/cls.module'
import { EnvModule } from './common/modules/env.module'
import { ThrottleRedisModule } from './common/modules/throttle-redis.module'
import { ThrottleRedisService } from './common/services/throttle-redis.service'
import { AppThrottlerGuard } from './common/guards/app-throttler.guard'
import { JwtAuthGuard } from './modules/auth/guards/jwt.auth.guard'
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor'
import { LoggerInterceptor } from './common/interceptors/logger.interceptor'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { PrismaHealthIndicator, RedisHealthIndicator } from './common/health/indicators'
import { AppShutdownService } from './common/services/app-shutdown.service'
import { StartupHealthService } from './common/services/startup-health.service'
import { VersionService } from './common/services/version.service'

import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { EmailModule } from './modules/email/email.module'
import { AdminModule } from './modules/admin/admin.module'
import { MessageBusModule } from './modules/message-bus/message-bus.module'
import { SettingsModule } from './modules/settings/settings.module'
import { WalletModule } from './modules/wallet/wallet.module'
import { PaymentModule } from './modules/payment/payment.module'
import { AiModule } from './modules/ai/ai.module'

import { AppController } from './app.controller'
import { HealthController } from './health.controller'

import { appConfig, databaseConfig, httpConfig, jwtConfig, rbacConfig, redisConfig, authRateLimitConfig, throttleConfig, messageBusConfig, prismaConfig, aiConfig } from './config/configuration'

@Module({
  imports: [
    // 配置模块 - 加载.env文件
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        httpConfig,
        jwtConfig,
        rbacConfig,
        authRateLimitConfig,
        throttleConfig,
        messageBusConfig,
        prismaConfig,
        aiConfig,
      ],
    }),

    // 健康检查（Terminus）
    TerminusModule,

    // 添加 Event Emitter 模块
    EventEmitterModule.forRoot(),

    // 定时任务基础设施（保留供后续扩展）
    ScheduleModule.forRoot(),

    // 添加 CLS 模块 - 用于上下文和事务管理
    ClsConfigModule,
    // 全局环境门面
    EnvModule,
    // 提供限流 Redis 客户端（供 StartupHealthService 与全局 Throttler 使用）
    ThrottleRedisModule,

    // Redis缓存模块
    NestCacheModule.registerAsync({
      isGlobal: true,
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('redis.host', 'localhost'),
        port: configService.get<number>('redis.port', 6379),
        password: configService.get<string>('redis.password', 'redis'),
        db: configService.get<number>('redis.db', 0),
        ttl: 60 * 60, // 默认缓存1小时（cache-manager-ioredis使用秒）
      }),
      inject: [ConfigService],
    }),

    // 队列模块 - 使用Redis作为后端
    BullModule.forRootAsync({
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password', 'redis'),
          db: configService.get<number>('redis.db', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),

    // Throttler 限流模块（全局）
    ThrottlerModule.forRootAsync({
      imports: [ThrottleRedisModule],
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: async (configService: ConfigService, throttleRedis: ThrottleRedisService) => {
        const appEnv = configService.get<string>('app.appEnv', 'development')
        const ttlMs = configService.get<number>('throttle.ttl', 60) * 1000 // 转换为毫秒
        const baseLimit = configService.get<number>('throttle.limit', 30)
        const limit = appEnv === 'test' || appEnv === 'e2e' ? 1000 : baseLimit
        const client = throttleRedis.getClient()
        return {
          throttlers: [
            {
              name: 'default',
              ttl: ttlMs,
              limit,
            },
          ],
          // 若未启用 Redis（测试/本地），回退内存存储
          ...(client ? { storage: new ThrottlerStorageRedisService(client) } : {}),
        }
      },
      inject: [ConfigService, ThrottleRedisService],
    }),

    // 日志模块
    WinstonModule.forRootAsync({
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: () => ({
        level: loggerConfig.level,
        transports: createWinstonTransports(),
      }),
    }),

    // Prisma模块
    PrismaModule,

    // 自定义缓存模块
    CacheModule,

    // 用户/认证/管理模块
    UserModule,
    AuthModule,
    EmailModule,
    AdminModule,

    // 消息总线与队列基础设施
    MessageBusModule,

    // 系统设置模块
    SettingsModule,

    // 钱包模块
    WalletModule,

    // 支付模块
    PaymentModule,

    // AI 模块
    AiModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    { provide: APP_INTERCEPTOR, useClass: LoggerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // 全局守卫顺序说明：
    // - Nest 会按 providers 数组中 APP_GUARD 注册顺序依次执行
    // - JwtAuthGuard 先执行（填充 req.user）
    // - AppThrottlerGuard 最后执行（可按 userId 计数）
    // - 公开端点通过 @Public() 豁免 JwtAuthGuard
    // 参考：https://docs.nestjs.com/guards#binding-guards
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局启用限流守卫（自定义 getTracker 与 429 日志）
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    AppShutdownService,
    // 启动期健康检查（Redis 连接失败时给出明确提示并退出）
    StartupHealthService,
    VersionService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('/')
  }
}
