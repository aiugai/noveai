import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { TTLInSeconds } from './cache.constants'

/**
 * 缓存服务
 *
 * TTL单位说明：
 * - 所有公开方法的TTL参数统一使用【秒】作为单位
 * - 内部会自动转换为cache-manager所需的毫秒
 * - Redis原生命令（如setIfNotExists）直接使用秒
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 从缓存获取数据
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.cacheManager.get<T>(key)
      return result === null ? undefined : result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to get cache key: ${key}: ${message}`, stack)
      return undefined
    }
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒）
   */
  async set<T>(key: string, value: T, ttl?: TTLInSeconds): Promise<void> {
    try {
      // cache-manager需要毫秒，所以转换单位
      const ttlInMs = ttl ? ttl * 1000 : undefined
      await this.cacheManager.set(key, value, ttlInMs)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to set cache key: ${key}: ${message}`, stack)
      throw error // 重新抛出异常，让调用者知道操作失败
    }
  }

  /**
   * 删除缓存数据
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to delete cache key: ${key}: ${message}`, stack)
    }
  }

  /**
   * 缓存不存在时，使用回调函数获取并缓存数据
   * @param key 缓存键
   * @param callback 获取数据的回调函数
   * @param ttl 过期时间（秒）
   */
  async getOrSet<T>(key: string, callback: () => Promise<T>, ttl?: TTLInSeconds): Promise<T> {
    const cachedValue = await this.get<T>(key)
    if (cachedValue !== undefined) {
      return cachedValue
    }

    try {
      const value = await callback()
      await this.set(key, value, ttl)
      return value
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to getOrSet cache key: ${key}: ${message}`, stack)
      throw error
    }
  }

  /**
   * 根据模式查找缓存键
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const store = this.cacheManager as { store?: { keys?: (pattern: string) => Promise<string[]> } }
      if (store.store && typeof store.store.keys === 'function') {
        const keys = await store.store.keys(pattern)
        return keys || []
      }
      return []
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to get cache keys by pattern: ${pattern}: ${message}`, stack)
      return []
    }
  }

  /**
   * 批量删除缓存数据（前缀匹配）
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // 实际实现取决于使用的缓存管理器
      // Redis支持pattern删除，但默认的Memory缓存不支持
      // 这里提供一个通用接口，具体实现在特定缓存模块中处理

      // 尝试使用store中的redis实例（如果存在）
      const keys = await this.keys(pattern)
      if (keys && keys.length) {
        // 使用 allSettled 处理单个键删除失败的情况
        const results = await Promise.allSettled(
          keys.map((key: string) => this.cacheManager.del(key)),
        )

        // 记录失败的删除操作
        const failures = results.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          this.logger.warn(
            `Failed to delete ${failures.length} of ${keys.length} cache keys for pattern: ${pattern}`,
          )
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to delete cache by pattern: ${pattern}: ${message}`, stack)
    }
  }

  /**
   * 分布式锁实现 - 仅在键不存在时设置
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒）
   * @throws Error when Redis connection fails or is unavailable
   */
  async setIfNotExists<T>(key: string, value: T, ttl?: TTLInSeconds): Promise<boolean> {
    try {
      const store = this.cacheManager as {
        store?: {
          client?: {
            set: (key: string, value: string, ...args: (string | number)[]) => Promise<string | null>
          }
        }
      }

      // Check if we have a Redis client (production) or memory cache (testing)
      if (store.store?.client && typeof store.store.client.set === 'function') {
        // Redis SET NX 命令 - Redis原生使用秒
        const ttlInSeconds = ttl || 300
        const result = await store.store.client.set(key, JSON.stringify(value), 'NX', 'EX', ttlInSeconds)
        return result === 'OK'
      } else {
        // Fallback for memory cache (e.g., in testing)
        const existing = await this.get(key)
        if (existing === undefined) {
          await this.set(key, value, ttl)
          return true
        }
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to setIfNotExists cache key: ${key}: ${message}`, stack)
      // Re-throw error instead of returning false to ensure proper error handling
      throw new Error(`Redis setIfNotExists operation failed for key ${key}: ${message}`)
    }
  }

  /**
   * 条件删除 - 仅在值匹配时删除
   * @throws Error when Redis connection fails or is unavailable
   */
  async deleteIfValue(key: string, expectedValue: unknown): Promise<boolean> {
    try {
      const store = this.cacheManager as {
        store?: {
          client?: {
            eval: (script: string, numKeys: number, ...args: string[]) => Promise<number>
          }
        }
      }

      // Check if we have a Redis client (production) or memory cache (testing)
      if (store.store?.client && typeof store.store.client.eval === 'function') {
        // Lua 脚本确保原子性
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `
        const result = await store.store.client.eval(luaScript, 1, key, JSON.stringify(expectedValue))
        return result === 1
      } else {
        // Fallback for memory cache (e.g., in testing)
        const currentValue = await this.get(key)
        if (
          currentValue !== undefined &&
          JSON.stringify(currentValue) === JSON.stringify(expectedValue)
        ) {
          await this.del(key)
          return true
        }
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to deleteIfValue cache key: ${key}: ${message}`, stack)
      // Re-throw error instead of returning false to ensure proper error handling
      throw new Error(`Redis deleteIfValue operation failed for key ${key}: ${message}`)
    }
  }

  /**
   * 续期分布式锁 - 仅在值匹配时刷新 TTL
   * @throws Error when Redis connection fails or is unavailable
   */
  async refreshIfValue(key: string, expectedValue: unknown, ttl?: TTLInSeconds): Promise<boolean> {
    try {
      const store = this.cacheManager as {
        store?: {
          client?: {
            eval: (script: string, numKeys: number, ...args: string[]) => Promise<number>
          }
        }
      }

      if (store.store?.client && typeof store.store.client.eval === 'function') {
        const ttlInSeconds = ttl || 300
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], tonumber(ARGV[2]))
          else
            return 0
          end
        `
        const result = await store.store.client.eval(
          luaScript,
          1,
          key,
          JSON.stringify(expectedValue),
          String(ttlInSeconds),
        )
        return result === 1
      }

      // Fallback for memory cache (e.g., in testing)
      const currentValue = await this.get(key)
      if (
        currentValue !== undefined &&
        JSON.stringify(currentValue) === JSON.stringify(expectedValue)
      ) {
        await this.set(key, expectedValue, ttl)
        return true
      }
      return false
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to refreshIfValue cache key: ${key}: ${message}`, stack)
      throw new Error(`Redis refreshIfValue operation failed for key ${key}: ${message}`)
    }
  }
}
