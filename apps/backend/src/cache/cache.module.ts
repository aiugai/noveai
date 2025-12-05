import { Global, Module } from '@nestjs/common'
import { CacheService } from './cache.service'

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}

// 导出常量以便其他模块使用
export { CacheKeyPrefix, CacheTTL, type TTLInSeconds } from './cache.constants'
