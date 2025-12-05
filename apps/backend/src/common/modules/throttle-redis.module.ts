import { Module } from '@nestjs/common'
import { ThrottleRedisService } from '../services/throttle-redis.service'
import { ConfigModule } from '@nestjs/config'

export const IOREDIS_CLIENT = 'IOREDIS_CLIENT'

@Module({
  imports: [ConfigModule],
  providers: [
    ThrottleRedisService,
    {
      provide: IOREDIS_CLIENT,
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: (svc: ThrottleRedisService) => svc.getClient(),
      inject: [ThrottleRedisService],
    },
  ],
  exports: [ThrottleRedisService, IOREDIS_CLIENT],
})
export class ThrottleRedisModule {}
