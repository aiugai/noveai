import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma, TransactionType, TransactionStatus, type WalletTransaction } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { EnvService } from '@/common/services/env.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { ClsService } from 'nestjs-cls'
import { CacheService } from '@/cache/cache.service'

// Prisma 7 兼容：从 Prisma 命名空间获取 Decimal 类型（值和类型）
type Decimal = Prisma.Decimal
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const Decimal = Prisma.Decimal

/**
 * Custom error types for aggregation service
 */
export class AggregationFailedException extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'AggregationFailedException'
  }
}

export class MemoryLimitExceededException extends Error {
  constructor(
    message: string,
    public readonly memoryUsage: number,
  ) {
    super(message)
    this.name = 'MemoryLimitExceededException'
  }
}

export class DataIntegrityException extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DataIntegrityException'
  }
}

/**
 * Billing type constants for chat aggregation
 * 聊天聚合计费类型常量（集中维护，避免硬编码）
 */
export const BILLING_TYPE_CHAT_SCORE = 'ai_chat_score' // 原始聊天消费记录
export const BILLING_TYPE_CHAT_SCORE_HOURLY = 'ai_chat_score_hourly' // 小时聚合记录 (v4.0)

/**
 * Interface for aggregation configuration
 */
export interface AggregationConfig {
  userBatchSize: number
  recordBatchSize: number
  memoryLimitMB: number
  missedWindowLookbackHours: number // 回溯检查遗漏窗口的小时数
}

/**
 * Interface for performance metrics
 */
interface PerformanceMetrics {
  startTime: number
  endTime?: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  recordsProcessed: number
  operationTimeMs?: number
}

/**
 * Interface for immutable statistics
 */
interface ImmutableStatistics {
  readonly totalRecords: number
  readonly totalAmount: string
  readonly totalInputTokens: number
  readonly totalOutputTokens: number
  readonly totalTokens: number
  readonly uniqueVirtualModels: readonly string[]
  readonly uniqueVirtualModelCount: number
  readonly sessionCount: number
  readonly storyCount: number
  readonly costBreakdown: {
    readonly totalInputCost: string
    readonly totalOutputCost: string
  }
  readonly timeRange: {
    readonly firstTransaction: string
    readonly lastTransaction: string
  }
}

/**
 * Interface for chat transaction metadata
 */
interface ChatTransactionMetadata {
  tokenUsage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  virtualModelId?: string
  context?: {
    sessionId?: string
    storyId?: string
  }
  costBreakdown?: {
    inputCost?: string
    outputCost?: string
  }
}

/**
 * Type guard to check if JsonValue is a valid object
 */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Chat Transaction Aggregation Service / 聊天交易聚合服务
 *
 * This service periodically aggregates multiple small chat consumption records
 * into a single summarized record to improve database performance and reduce
 * storage overhead while preserving detailed statistics in metadata.
 *
 * 该服务定期将多个小的聊天消费记录聚合成单个汇总记录，
 * 以提高数据库性能并减少存储开销，同时在元数据中保留详细统计信息。
 */
@Injectable()
export class ChatTransactionAggregationService {
  private readonly logger = new Logger(ChatTransactionAggregationService.name)
  private readonly config: AggregationConfig

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly txEvents: TransactionEventsService,
    private readonly cls: ClsService,
    private readonly cache: CacheService,
  ) {
    this.config = {
      userBatchSize: 100,
      recordBatchSize: 500,
      // 内存限制：开发/E2E 环境 2GB，生产环境 1.5GB
      // 注：NestJS 应用基础内存占用约 800-1000MB，需要预留足够空间
      memoryLimitMB: this.env.isProd() ? 1536 : 2048,
      // 回溯检查遗漏窗口的小时数（生产环境 48 小时，测试环境 24 小时）
      missedWindowLookbackHours: this.env.isProd() ? 48 : 24,
    }

  }

  /**
   * Cron job that runs hourly to perform chat transaction aggregation
   * 每小时运行的定时任务,执行聊天交易聚合
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'runHourlyAggregation', timeZone: 'UTC' })
  async runHourlyAggregation(): Promise<void> {
    const lockKey = 'wallet:aggregation:hourly'
    const lockValue = {
      startedAt: new Date().toISOString(),
      source: 'cron',
      token: `${Date.now()}-${Math.random()}`,
    }

    this.logger.log('Starting hourly chat transaction aggregation')
    const metrics = this.createPerformanceMetrics()

    try {
      // 🆕 第一步：检查并处理遗漏的窗口
      const missedWindows = await this.findMissedWindows()

      // 🆕 根据遗漏窗口数量动态计算锁TTL（每个窗口预估120秒 + 基础600秒）
      const estimatedTimePerWindow = 120 // 秒
      const baseLockTime = 600 // 10分钟基础时间
      const dynamicLockTTL = Math.max(
        baseLockTime,
        baseLockTime + missedWindows.length * estimatedTimePerWindow,
      )

      this.logger.log(`计算锁TTL: ${dynamicLockTTL}秒 (基础=${baseLockTime}, 遗漏窗口=${missedWindows.length})`)

      // 获取分布式锁，避免多实例重复执行
      const acquired = await this.cache.setIfNotExists(lockKey, lockValue, dynamicLockTTL)
      if (!acquired) {
        this.logger.warn('Hourly aggregation is already running on another instance, skipping')
        return
      }
      if (missedWindows.length > 0) {
        this.logger.warn(`发现 ${missedWindows.length} 个遗漏窗口，开始补聚合`, {
          missedWindows: missedWindows.map(w => ({
            start: w.start.toISOString(),
            end: w.end.toISOString(),
          })),
        })

        let missedProcessed = 0
        let missedAggregated = 0
        let missedCreated = 0

        for (const window of missedWindows) {
          try {
            const missedResult = await this.aggregateSpecificWindow(window.start, window.end)
            missedProcessed += missedResult.usersProcessed
            missedAggregated += missedResult.recordsAggregated
            missedCreated += missedResult.recordsCreated

            this.logger.log(`补聚合窗口完成: ${window.start.toISOString()} - ${window.end.toISOString()}`, {
              usersProcessed: missedResult.usersProcessed,
              recordsAggregated: missedResult.recordsAggregated,
            })
          } catch (error) {
            this.logger.error(`补聚合窗口失败: ${window.start.toISOString()} - ${window.end.toISOString()}`, {
              error: error.message,
              stack: error.stack,
            })
            // 单个窗口失败不影响其他窗口和当前窗口的处理
          }
        }

        if (missedProcessed > 0) {
          this.logger.log(`遗漏窗口补聚合完成`, {
            windowsProcessed: missedWindows.length,
            usersProcessed: missedProcessed,
            recordsAggregated: missedAggregated,
            recordsCreated: missedCreated,
          })
        }
      }

      // 第二步：处理当前窗口（上一个完整小时）
      const result = await this.aggregateChatTransactions()
      this.logPerformanceMetrics(metrics, result.recordsAggregated)

      this.logger.log('Hourly aggregation completed successfully', {
        usersProcessed: result.usersProcessed,
        recordsAggregated: result.recordsAggregated,
        recordsCreated: result.recordsCreated,
        executionTimeMs: metrics.operationTimeMs,
      })

      if (result.errors && result.errors.length > 0) {
        this.logger.warn(
          `部分用户聚合失败 (${result.errors.length}/${result.usersProcessed + result.errors.length}): ${JSON.stringify(result.errors)}`,
        )
      }
    } catch (error) {
      this.logPerformanceMetrics(metrics, 0)

      if (
        error instanceof AggregationFailedException ||
        error instanceof MemoryLimitExceededException ||
        error instanceof DataIntegrityException
      ) {
        this.logger.error(`Hourly aggregation failed: ${error.name}`, {
          error: error.message,
          type: error.constructor.name,
          context: 'cause' in error ? error.cause : undefined,
        })
      } else {
        this.logger.error('Hourly aggregation failed with unexpected error', {
          error: error.message,
          stack: error.stack,
        })
      }
      throw error
    } finally {
      // 主动释放锁
      const released = await this.cache.deleteIfValue(lockKey, lockValue)
      if (released) {
        this.logger.log('Hourly aggregation lock released successfully')
      } else {
        this.logger.warn('Hourly aggregation lock release failed (may already expired or changed)')
      }
    }
  }

  /**
   * Calculate target aggregation window (previous complete hour in UTC)
   * 计算目标聚合窗口（UTC 时区的上一个完整小时）
   *
   * 示例：
   * - 当前时间：2025-10-13 14:05:23 UTC
   * - 返回窗口：{ start: 2025-10-13 13:00:00.000Z, end: 2025-10-13 14:00:00.000Z }
   */
  private calculateTargetWindow(): { start: Date; end: Date } {
    const now = new Date()
    const windowEnd = new Date(now)

    // 将当前时间截断到整点（去掉分钟、秒、毫秒）
    windowEnd.setUTCMinutes(0, 0, 0)

    // 窗口开始时间 = 窗口结束时间 - 1 小时
    const windowStart = new Date(windowEnd)
    windowStart.setUTCHours(windowStart.getUTCHours() - 1)

    return { start: windowStart, end: windowEnd }
  }

  /**
   * Find missed aggregation windows within the lookback period
   * 查找回溯期内遗漏的聚合窗口
   *
   * 逻辑：
   * 1. 从当前时间往前回溯 N 小时（配置项 missedWindowLookbackHours）
   * 2. 找出有消费记录但无聚合记录的窗口
   * 3. 按时间正序返回（从最早的窗口开始处理）
   *
   * @returns 遗漏的窗口列表（按时间正序）
   */
  private async findMissedWindows(): Promise<Array<{ start: Date; end: Date }>> {
    const now = new Date()
    const currentHour = new Date(now)
    currentHour.setUTCMinutes(0, 0, 0)

    // 回溯起点：当前整点 - lookback 小时数
    const lookbackStart = new Date(currentHour)
    lookbackStart.setUTCHours(lookbackStart.getUTCHours() - this.config.missedWindowLookbackHours)

    // 上一个完整小时（当前任务应处理的窗口，不包含在遗漏检查中）
    const previousHourEnd = currentHour
    const previousHourStart = new Date(previousHourEnd)
    previousHourStart.setUTCHours(previousHourStart.getUTCHours() - 1)

    this.logger.debug(`检查遗漏窗口`, {
      lookbackStart: lookbackStart.toISOString(),
      lookbackEnd: previousHourStart.toISOString(),
      lookbackHours: this.config.missedWindowLookbackHours,
    })

    // 查询：按小时分组，找出有消费记录但无聚合记录的窗口
    const missedWindowsRaw = await this.prisma.$queryRaw<Array<{ window_hour: Date }>>`
      WITH consumption_hours AS (
        -- 找出有消费记录的小时
        SELECT DISTINCT
          date_trunc('hour', "created_at") as window_hour
        FROM "wallet_transactions"
        WHERE "type" = 'CONSUMPTION'
          AND "status" = 'COMPLETED'
          AND "metadata"->>'billingType' = ${BILLING_TYPE_CHAT_SCORE}
          AND "created_at" >= ${lookbackStart}
          AND "created_at" < ${previousHourStart}
      ),
      aggregated_hours AS (
        -- 找出已聚合的小时
        SELECT DISTINCT
          ("metadata"->'aggregationInfo'->>'windowStart')::timestamp as window_hour
        FROM "wallet_transactions"
        WHERE "metadata"->>'billingType' = ${BILLING_TYPE_CHAT_SCORE_HOURLY}
          AND ("metadata"->'aggregationInfo'->>'windowStart')::timestamp >= ${lookbackStart}
          AND ("metadata"->'aggregationInfo'->>'windowStart')::timestamp < ${previousHourStart}
      )
      -- 返回有消费记录但无聚合记录的窗口
      SELECT ch.window_hour
      FROM consumption_hours ch
      LEFT JOIN aggregated_hours ah ON ch.window_hour = ah.window_hour
      WHERE ah.window_hour IS NULL
      ORDER BY ch.window_hour ASC
    `

    const missedWindows = missedWindowsRaw.map(row => {
      const start = new Date(row.window_hour)
      const end = new Date(start)
      end.setUTCHours(end.getUTCHours() + 1)
      return { start, end }
    })

    if (missedWindows.length > 0) {
      this.logger.log(`发现 ${missedWindows.length} 个遗漏窗口`, {
        windows: missedWindows.map(w => w.start.toISOString()),
      })
    }

    return missedWindows
  }

  /**
   * Aggregate a specific time window
   * 聚合指定时间窗口（用于补漏）
   *
   * @param windowStart 窗口开始时间
   * @param windowEnd 窗口结束时间
   * @returns 聚合结果
   */
  async aggregateSpecificWindow(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<{
    usersProcessed: number
    recordsAggregated: number
    recordsCreated: number
    errors?: Array<{ walletId: string; error: string }>
  }> {
    this.logger.log(`开始聚合指定窗口: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`)

    let usersProcessed = 0
    let totalRecordsAggregated = 0
    let totalRecordsCreated = 0
    const errors: Array<{ walletId: string; error: string }> = []

    try {
      let hasMoreUsers = true

      // 采用"固定 Top-N 循环"模式：每轮从头取 limit 条
      // 处理完的钱包会被删除记录，下轮自然不再出现
      // 避免使用 page/OFFSET 导致的"删除后位移"问题
      while (hasMoreUsers) {
        const walletBatch = await this.findUsersInWindow(
          windowStart,
          windowEnd,
          0, // 始终从第 0 页开始
          this.config.userBatchSize,
        )

        if (walletBatch.length === 0) {
          hasMoreUsers = false
          break
        }

        for (const wallet of walletBatch) {
          try {
            const result = await this.aggregateWalletHourInTransaction(
              wallet.walletId,
              windowStart,
              windowEnd,
            )

            if (result.success) {
              usersProcessed++
              totalRecordsAggregated += result.recordsAggregated
              totalRecordsCreated += result.recordsCreated
            }
          } catch (error) {
            this.logger.error(`钱包 ${wallet.walletId} 聚合失败 (补漏窗口)`, {
              error: error.message,
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString(),
            })

            errors.push({
              walletId: wallet.walletId,
              error: error.message,
            })

            if (error instanceof DataIntegrityException) {
              throw error
            }
          }
        }

        // 不再递增 page，因为已处理的钱包已删除，下轮从头查即可
      }

      return {
        usersProcessed,
        recordsAggregated: totalRecordsAggregated,
        recordsCreated: totalRecordsCreated,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      if (error instanceof DataIntegrityException || error instanceof MemoryLimitExceededException) {
        throw error
      }

      throw new AggregationFailedException(
        `补漏窗口聚合失败: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
        error,
      )
    }
  }

  /**
   * Main aggregation method: processes all eligible users for the target window
   * 主聚合方法：处理目标窗口内所有符合条件的用户
   */
  async aggregateChatTransactions(): Promise<{
    usersProcessed: number
    recordsAggregated: number
    recordsCreated: number
    windowStart?: string
    windowEnd?: string
    errors?: Array<{ walletId: string; error: string }>
  }> {
    this.logger.debug('开始聊天交易聚合流程')
    this.logMemory('聚合流程开始')

    // 计算目标窗口（上一个完整小时）
    const { start: windowStart, end: windowEnd } = this.calculateTargetWindow()
    this.logger.log(`目标聚合窗口: ${windowStart.toISOString()} - ${windowEnd.toISOString()}`)

    let usersProcessed = 0
    let totalRecordsAggregated = 0
    let totalRecordsCreated = 0
    const errors: Array<{ walletId: string; error: string }> = []
    let batchNumber = 0
    const metrics = this.createPerformanceMetrics()

    try {
      // 采用"固定 Top-N 循环"模式：每轮从头取 limit 条
      // 处理完的钱包会被删除记录，下轮自然不再出现
      // 避免使用 page/OFFSET 导致的"删除后位移"问题
      let hasMoreUsers = true

      while (hasMoreUsers) {
        batchNumber++
        this.logMemory(`开始处理第 ${batchNumber} 批钱包`)
        this.checkMemoryUsage()

        const walletBatch = await this.findUsersInWindow(
          windowStart,
          windowEnd,
          0, // 始终从第 0 页开始
          this.config.userBatchSize, // 100
        )

        if (walletBatch.length === 0) {
          hasMoreUsers = false
          break
        }

        this.logger.debug(`处理第 ${batchNumber} 批，共 ${walletBatch.length} 个钱包，预计记录数: ${walletBatch.reduce((sum, w) => sum + w.recordCount, 0)}`)

        // 为每个钱包建立独立事务
        for (const wallet of walletBatch) {
          try {
            this.logMemory(`开始处理钱包 ${wallet.walletId}（预计 ${wallet.recordCount} 条记录）`)

            const result = await this.aggregateWalletHourInTransaction(
              wallet.walletId,
              windowStart,
              windowEnd,
            )

            if (result.success) {
              usersProcessed++
              totalRecordsAggregated += result.recordsAggregated
              totalRecordsCreated += result.recordsCreated
              metrics.recordsProcessed += result.recordsAggregated

              this.logMemory(`钱包 ${wallet.walletId} 处理完成（实际 ${result.recordsAggregated} 条）`)
            }
          } catch (error) {
            // 单个钱包失败不影响其他钱包
            this.logger.error(`钱包 ${wallet.walletId} 聚合失败: ${error.message}`, error.stack)
            this.logMemory(`钱包 ${wallet.walletId} 失败时内存状态`)

            errors.push({
              walletId: wallet.walletId,
              error: error.message,
            })

            // 数据完整性错误需要立即中断整个流程
            if (error instanceof DataIntegrityException) {
              this.logger.error(`数据完整性错误，中断聚合流程`, {
                error: error.message,
                context: error.context,
              })
              throw error
            }
            // 其他错误继续处理下一个钱包
          }
        }

        // 不再递增 page，因为已处理的钱包已删除，下轮从头查即可
      }

      this.logPerformanceMetrics(metrics, totalRecordsAggregated)

      return {
        usersProcessed,
        recordsAggregated: totalRecordsAggregated,
        recordsCreated: totalRecordsCreated,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      this.logPerformanceMetrics(metrics, totalRecordsAggregated)

      if (
        error instanceof MemoryLimitExceededException ||
        error instanceof DataIntegrityException
      ) {
        throw error
      }

      const aggregationError = new AggregationFailedException(
        `聚合流程失败，已处理 ${usersProcessed} 个用户`,
        error,
      )

      this.logger.error('聚合流程失败', {
        error: aggregationError.message,
        cause: error.message,
        usersProcessed,
        recordsProcessed: totalRecordsAggregated,
        window: `${windowStart.toISOString()} - ${windowEnd.toISOString()}`,
      })

      throw aggregationError
    }
  }

  /**
   * Find users with chat consumption records in the target time window,
   * excluding those already aggregated for this window (idempotency check)
   * 查询目标时间窗口内有聊天消费记录的用户（分页），排除已聚合的窗口（幂等性检查）
   *
   * @param windowStart 窗口开始时间（UTC）
   * @param windowEnd 窗口结束时间（UTC）
   * @param page 页码（从 0 开始）
   * @param limit 每页大小（默认 100）
   * @returns 钱包 ID 和记录数列表
   */
  private async findUsersInWindow(
    windowStart: Date,
    windowEnd: Date,
    page: number = 0,
    limit: number = 100,
  ): Promise<{ walletId: string; recordCount: number }[]> {
    const offset = page * limit

    // 查询窗口内有消费记录的钱包，排除已聚合的窗口
    const result = await this.prisma.$queryRaw<{ walletId: string; recordCount: bigint }[]>`
      SELECT "from_wallet_id" as "walletId", COUNT(*) as "recordCount"
      FROM "wallet_transactions"
      WHERE "type" = 'CONSUMPTION'
        AND "status" = 'COMPLETED'
        AND "metadata"->>'billingType' = ${BILLING_TYPE_CHAT_SCORE}
        AND "created_at" >= ${windowStart}
        AND "created_at" < ${windowEnd}
        AND NOT EXISTS (
          -- 幂等性检查：排除已为该窗口创建聚合记录的钱包
          SELECT 1 FROM "wallet_transactions" agg
          WHERE agg."from_wallet_id" = "wallet_transactions"."from_wallet_id"
            AND agg."metadata"->>'billingType' = ${BILLING_TYPE_CHAT_SCORE_HOURLY}
            AND agg."metadata"->'aggregationInfo'->>'windowStart' = ${windowStart.toISOString()}
        )
      GROUP BY "from_wallet_id"
      ORDER BY COUNT(*) DESC, "from_wallet_id"
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return result.map(row => ({
      walletId: row.walletId,
      recordCount: Number(row.recordCount),
    }))
  }

  /**
   * Aggregate chat transactions for a specific wallet within a time window
   * 聚合特定钱包在指定时间窗口内的聊天交易
   *
   * @param walletId 钱包 ID
   * @param windowStart 窗口开始时间（UTC）
   * @param windowEnd 窗口结束时间（UTC）
   * @returns 聚合结果
   */
  async aggregateWalletHour(
    walletId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<{
    success: boolean
    recordsAggregated: number
    recordsCreated: number
    message?: string
  }> {
    this.logger.debug(`聚合钱包窗口数据`, {
      walletId,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    })

    try {
      const tx = this.prisma.getClient()

      // 查询窗口内的所有聊天消费记录（批量处理）
      let hasMoreRecords = true
      let totalRecords = 0
      let totalAmount = new Decimal(0)
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalTokens = 0
      let totalInputCost = 0
      let totalOutputCost = 0
      const uniqueVirtualModels = new Set<string>()
      const uniqueSessions = new Set<string>()
      const uniqueStories = new Set<string>()
      let firstRecord: WalletTransaction | null = null
      let lastRecord: WalletTransaction | null = null
      let fromWalletId: string | null = null

      let batchNumber = 0
      while (hasMoreRecords) {
        batchNumber++
        this.logMemory(`钱包 ${walletId} 批次 ${batchNumber} 开始查询（累计已处理 ${totalRecords} 条）`)

        // 流式处理：每次从头查询（因为上一批已删除），避免 deep pagination
        const batchRecords = await tx.walletTransaction.findMany({
          where: {
            fromWalletId: walletId,
            type: TransactionType.CONSUMPTION,
            status: TransactionStatus.COMPLETED,
            metadata: {
              path: ['billingType'],
              equals: BILLING_TYPE_CHAT_SCORE,
            },
            createdAt: {
              gte: windowStart, // 窗口开始（包含）
              lt: windowEnd, // 窗口结束（不包含）
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: this.config.recordBatchSize, // 500 条/批次
          // 不使用 skip：每次删除后从头查询，避免 deep pagination 导致的内存爆炸
        })

        this.logger.debug(`钱包 ${walletId} 批次 ${batchNumber} 查询到 ${batchRecords.length} 条记录`)

        if (batchRecords.length === 0) {
          hasMoreRecords = false
        } else {
          for (const record of batchRecords) {
            // 第一次记录，初始化上下文
            if (!firstRecord) {
              firstRecord = record
              fromWalletId = record.fromWalletId
            }

            // 数据完整性校验（逐条进行，避免累积异常）
            if (!record.amount || !record.createdAt || !record.id || !record.assetTypeId) {
              throw new DataIntegrityException('Records with missing required fields found', {
                walletId,
                invalidRecordId: record.id ?? 'unknown',
              })
            }

            if (new Decimal(record.amount).isNegative()) {
              throw new DataIntegrityException('Records with negative amounts found', {
                walletId,
                recordId: record.id,
              })
            }

            if (fromWalletId && record.fromWalletId !== fromWalletId) {
              throw new DataIntegrityException('Inconsistent from wallet IDs found in records', {
                walletId,
                expectedWalletId: fromWalletId,
                inconsistentRecordId: record.id,
              })
            }

            // 聚合统计
            totalRecords++
            totalAmount = totalAmount.add(new Decimal(record.amount))
            lastRecord = record

            // 安全地转换 metadata（使用类型守卫）
            const metadata = isJsonObject(record.metadata)
              ? (record.metadata as ChatTransactionMetadata)
              : undefined

            if (metadata?.tokenUsage) {
              totalInputTokens += metadata.tokenUsage.inputTokens || 0
              totalOutputTokens += metadata.tokenUsage.outputTokens || 0
              totalTokens += metadata.tokenUsage.totalTokens || 0
            }

            if (metadata?.virtualModelId) {
              uniqueVirtualModels.add(metadata.virtualModelId)
            }

            if (metadata?.context?.sessionId) {
              uniqueSessions.add(metadata.context.sessionId)
            }

            if (metadata?.context?.storyId) {
              uniqueStories.add(metadata.context.storyId)
            }

            if (metadata?.costBreakdown) {
              totalInputCost += parseFloat(metadata.costBreakdown.inputCost || '0')
              totalOutputCost += parseFloat(metadata.costBreakdown.outputCost || '0')
            }
          }

          this.logMemory(`钱包 ${walletId} 批次 ${batchNumber} 统计完成，准备删除 ${batchRecords.length} 条`)

          // 流式删除：处理完当前批次立即删除，避免累积内存
          await tx.walletTransaction.deleteMany({
            where: {
              id: {
                in: batchRecords.map(r => r.id),
              },
            },
          })

          this.logMemory(`钱包 ${walletId} 批次 ${batchNumber} 删除完成`)

          // 停止条件：部分批次（说明已到末尾）
          if (batchRecords.length < this.config.recordBatchSize) {
            hasMoreRecords = false
          }
        }

        // 每批检查一次整体内存，防止极端情况
        this.checkMemoryUsage()
      }

      // 空窗口处理：不创建聚合记录
      if (totalRecords === 0 || !firstRecord || !lastRecord) {
        this.logger.debug(`窗口内无消费记录，跳过聚合`, {
          walletId,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        })
        return {
          success: false,
          recordsAggregated: 0,
          recordsCreated: 0,
          message: '窗口内无消费记录',
        }
      }

      // 计算聚合统计信息
      const aggregatedStats: { totalAmount: Decimal; statistics: ImmutableStatistics } = {
        totalAmount,
        statistics: {
          totalRecords,
          totalAmount: totalAmount.toString(),
          totalInputTokens,
          totalOutputTokens,
          totalTokens,
          uniqueVirtualModels: Array.from(uniqueVirtualModels),
          uniqueVirtualModelCount: uniqueVirtualModels.size,
          sessionCount: uniqueSessions.size,
          storyCount: uniqueStories.size,
          costBreakdown: {
            totalInputCost: totalInputCost.toFixed(6),
            totalOutputCost: totalOutputCost.toFixed(6),
          },
          timeRange: {
            firstTransaction: firstRecord.createdAt.toISOString(),
            lastTransaction: lastRecord.createdAt.toISOString(),
          },
        },
      }

      // 构造 uniqueId（幂等键）
      const uniqueId = `chat_hourly_${walletId}_${windowStart.getTime()}`

      // 创建聚合交易记录（v4.0 格式）
      await tx.walletTransaction.create({
        data: {
          fromWalletId: walletId,
          toWalletId: firstRecord.toWalletId,
          assetTypeId: firstRecord.assetTypeId,
          amount: aggregatedStats.totalAmount,
          type: TransactionType.CONSUMPTION,
          status: TransactionStatus.COMPLETED,
          reason: 'AI chat billing - hourly aggregated',
          metadata: {
            billingType: BILLING_TYPE_CHAT_SCORE_HOURLY, // v4.0 标识
            aggregationInfo: {
              aggregatedAt: new Date().toISOString(),
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString(),
              recordsAggregated: totalRecords,
            },
            statistics: JSON.parse(JSON.stringify(aggregatedStats.statistics)),
            billingVersion: '4.0', // 版本号升级
          },
          uniqueId, // chat_hourly_${walletId}_${windowStartMs}
          userId: firstRecord.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      this.logger.log(`成功聚合窗口数据：${totalRecords} 条记录`, {
        walletId,
        windowStart: windowStart.toISOString(),
        recordsAggregated: totalRecords,
      })

      return {
        success: true,
        recordsAggregated: totalRecords,
        recordsCreated: 1,
      }
    } catch (error) {
      // 捕获唯一键冲突（P2002）
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(`窗口已聚合，跳过`, {
          walletId,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          uniqueId: `chat_hourly_${walletId}_${windowStart.getTime()}`,
        })
        return {
          success: true,
          recordsAggregated: 0,
          recordsCreated: 0,
          message: '窗口已聚合',
        }
      }

      if (error instanceof DataIntegrityException) {
        throw error
      }

      const aggregationError = new AggregationFailedException(
        `聚合窗口数据失败：walletId=${walletId}, window=${windowStart.toISOString()}`,
        error,
      )

      this.logger.error(aggregationError.message, {
        walletId,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        error: error.message,
        errorType: error.constructor.name,
      })

      throw aggregationError
    }
  }

  /**
   * 在独立事务中聚合单个钱包的窗口数据
   *
   * @param walletId 钱包 ID
   * @param windowStart 窗口开始时间
   * @param windowEnd 窗口结束时间
   * @returns 聚合结果
   */
  private async aggregateWalletHourInTransaction(
    walletId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<{ success: boolean; recordsAggregated: number; recordsCreated: number }> {
    return await this.cls.run(async () => {
      // 为每个钱包创建独立的 CLS 事务上下文
      this.txEvents.reset()

      return await this.prisma.runInTransaction(async () => {
        // 调用单钱包窗口聚合逻辑
        return await this.aggregateWalletHour(walletId, windowStart, windowEnd)
      })
    })
  }

  /**
   * Create performance metrics tracker
   * 创建性能指标跟踪器
   */
  private createPerformanceMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage()

    return {
      startTime: Date.now(),
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      recordsProcessed: 0,
    }
  }

  /**
   * Log performance metrics
   * 记录性能指标
   */
  private logPerformanceMetrics(metrics: PerformanceMetrics, recordsProcessed: number): void {
    const endTime = Date.now()
    const operationTimeMs = endTime - metrics.startTime
    const currentMemory = process.memoryUsage()

    metrics.endTime = endTime
    metrics.operationTimeMs = operationTimeMs
    metrics.recordsProcessed = recordsProcessed

    this.logger.debug('Performance metrics', {
      executionTimeMs: operationTimeMs,
      recordsProcessed,
      recordsPerSecond:
        recordsProcessed > 0 ? Math.round((recordsProcessed / operationTimeMs) * 1000) : 0,
      memoryUsage: {
        start: {
          heapUsedMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024),
        },
        end: {
          heapUsedMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(currentMemory.heapTotal / 1024 / 1024),
        },
        delta: {
          heapUsedMB: Math.round(
            (currentMemory.heapUsed - metrics.memoryUsage.heapUsed) / 1024 / 1024,
          ),
        },
      },
    })
  }

  /**
   * Check memory usage and throw error if exceeds limit
   * 检查内存使用情况，超限时抛出错误
   */
  private checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage()
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024

    if (heapUsedMB > this.config.memoryLimitMB) {
      throw new MemoryLimitExceededException(
        `Memory usage ${Math.round(heapUsedMB)}MB exceeds limit ${this.config.memoryLimitMB}MB`,
        heapUsedMB,
      )
    }
  }

  /**
   * Log current memory usage with context
   * 记录当前内存使用情况及上下文
   */
  private logMemory(context: string): void {
    const mem = process.memoryUsage()
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024)
    const externalMB = Math.round(mem.external / 1024 / 1024)
    const rssMB = Math.round(mem.rss / 1024 / 1024)

    // 生产环境使用 debug 级别，避免淹没关键日志
    this.logger.debug(`[内存追踪] ${context} | 堆已用: ${heapUsedMB}MB / ${heapTotalMB}MB | 外部: ${externalMB}MB | RSS: ${rssMB}MB | 限制: ${this.config.memoryLimitMB}MB`)
  }

}
