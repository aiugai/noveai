import { INestApplication, OnModuleInit, OnModuleDestroy, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EnvService } from '@/common/services/env.service'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { ClsService } from 'nestjs-cls'
import { generateShortId } from '@ai/shared'
// 使用动态导入避免测试环境问题
// import cuid2Extension from 'prisma-extension-cuid2';

const TRANSACTION_KEY = 'PRISMA_TRANSACTION'

// 模型名称列表
export const ModelNames = [
  // 用户相关
  'User',
  'UserSettings',
  'UserRelationship',
  'Role',
  'Permission',

  // 角色相关
  'Character',
  'CharacterRating',
  'CharacterFavorite',
  'CharacterUsageStat',
  'CharacterTag',
  'CharacterAuditHistory',
  'CharacterComment',

  // 故事和消息相关
  'Story',
  'Message',
  'ContextMemory',
  'FileRecord',
  'SharedStory',

  // 钱包和支付相关
  'Wallet',
  'AssetType',
  'WalletAsset',
  'WalletTransaction',
  'PaymentOrder',
  'WithdrawRequest',
  'InviteRewardGrant',
  'InviteRewardUnlockLog',
  'InviteRewardUnlockConfig',

  // 模型相关
  'ModelProvider',
  'Model',
  'VirtualModel',

  // 预设相关
  'Preset',
  'Prompt',

  // 邀请和佣金相关
  'InvitationCode',
  'InvitationRelationship',
  'CommissionRate',
  'CommissionRecord',
  'CommissionStatistics',
  'CommissionSettings',

  // 活动相关
  'ActivityDefinition',
  'UserActivityProgress',

  // 世界书相关
  'WorldInfo',
  'WorldInfoEntry',
  'WorldInfoActivation',
  'WorldInfoTimedState',

  // 聊天调试相关
  'ChatDebugSession',
  'ChatDebugStep',
  'ChatDebugPrompt',

  // 标签相关
  'PinnedTag',
  // 广告
  'Advertisement',

  // 系统设置
  'SystemSetting',
] as const

// 更明确的扩展客户端类型，避免使用不安全的双重断言。
// 当前等价于 PrismaClient，仅作为语义化约束与未来扩展的占位（可添加自定义方法/属性）。
interface ExtendedPrismaClient extends PrismaClient {}

// 定义需要自动生成短ID的模型列表
const MODELS_NEEDING_SHORT_ID: readonly string[] = [
  // 用户和权限相关
  'User',
  'UserSettings',
  'UserRelationship',
  'Role',
  'Permission',

  // 角色相关
  'Character',
  'CharacterRating',
  'CharacterFavorite',
  'CharacterUsageStat',
  'CharacterTag',
  'CharacterAuditHistory',
  'CharacterComment',

  // 故事和消息相关
  'Story',
  'Message',
  'ContextMemory',
  'FileRecord',
  'SharedStory',

  // 钱包和支付相关
  'Wallet',
  'AssetType',
  'WalletAsset',
  'WalletTransaction',
  'PaymentOrder',
  'WithdrawRequest',
  'InviteRewardGrant',
  'InviteRewardUnlockLog',
  'InviteRewardUnlockConfig',

  // 模型相关
  'ModelProvider',
  'Model',
  'VirtualModel',

  // 预设相关
  'Preset',
  'Prompt',

  // 邀请和佣金相关
  'InvitationCode',
  'InvitationRelationship',
  'CommissionRate',
  'CommissionRecord',
  'CommissionStatistics',
  'CommissionSettings',

  // 活动相关
  'ActivityDefinition',
  'UserActivityProgress',

  // 世界书相关
  'WorldInfo',
  'WorldInfoEntry',
  'WorldInfoActivation',

  // 聊天调试相关
  'ChatDebugSession',
  'ChatDebugStep',
  'ChatDebugPrompt',

  // 标签相关
  'PinnedTag',

  // 系统设置
  'SystemSetting',
]

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService')
  private extendedClient: ExtendedPrismaClient | null = null
  private pool: Pool | null = null

  constructor(
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
    private readonly env: EnvService,
  ) {
    // Prisma 7: 使用 driver adapter 连接 PostgreSQL
    const connectionString = defaultEnvAccessor.str('DATABASE_URL', '') || ''
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)

    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    })

    // 保存 pool 引用以便后续关闭
    this.pool = pool
  }

  async onModuleInit() {
    if (this.env.getString('SKIP_PRISMA_CONNECT') === 'true') {
      this.logger.warn('跳过 Prisma 连接 (SKIP_PRISMA_CONNECT=true)')
      this.applyShortIdExtension()
      this.setupQueryLogging()
      return
    }

    try {
      await this.$connect()
    } catch (error) {
      const dbUrl = this.env.getString('DATABASE_URL') || ''
      let masked = '(未设置)'
      if (dbUrl) {
        masked = dbUrl
        try {
          const u = new URL(dbUrl)
          if (u.password) u.password = '****'
          masked = u.toString()
        } catch {
          // 回退：若为非标准URL，避免抛错
          masked = dbUrl.replace(/(:)([^:@/]+)(@)/, '$1****$3')
        }
      }
      this.logger.error(
        `数据库连接失败：无法连接到 Postgres。\n` +
          `- DATABASE_URL: ${masked}\n` +
          `- 请检查数据库服务是否已启动、地址/端口/数据库名/用户名/密码是否正确。\n` +
          `- 如在本地，请确认 docker/postgres 是否在运行；如在云端，请检查网络与安全组。\n` +
          `原始错误：${(error as Error)?.message}`,
      )
      // 避免在 Service 中直接退出，抛出让应用启动失败，由上层进程管理器处理退出
      throw error
    }
    this.applyShortIdExtension()
    this.setupQueryLogging()
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...')
    await this.$disconnect()
    // Prisma 7: 关闭连接池
    if (this.pool) {
      await this.pool.end()
    }
    this.logger.log('Database disconnected successfully')
  }

  private applyShortIdExtension() {
    // Prisma 6.14 中 $use 已被移除，使用 $extends 替代
    // 注意：$extends 会返回一个新的客户端，不会原地修改当前实例，需要保存并复用
    this.extendedClient = this.$extends({
      query: {
        $allModels: {
          async create({ model, operation: _operation, args, query }) {
            if (MODELS_NEEDING_SHORT_ID.includes(model)) {
              const data = args.data as any
              if (!data.id) {
                data.id = generateShortId()
              }
            }
            return query(args)
          },
          async createMany({ model, operation: _operation, args, query }) {
            if (MODELS_NEEDING_SHORT_ID.includes(model) && Array.isArray(args.data)) {
              args.data.forEach((item: any) => {
                if (!item.id) {
                  item.id = generateShortId()
                }
              })
            }
            return query(args)
          },
          async upsert({ model, operation: _operation, args, query }) {
            if (MODELS_NEEDING_SHORT_ID.includes(model)) {
              const create = args.create as any
              if (create && !create.id) {
                create.id = generateShortId()
              }
            }
            return query(args)
          },
        },
        // 软删除中间件：暂时禁用以避免类型问题
        // TODO: 修复Prisma扩展中的TypeScript类型定义
        // User中间件已移至service层手动处理
      },
    }) as ExtendedPrismaClient
    this.logger.log('Short ID extension applied (soft delete middleware temporarily disabled).')

    // 将模型代理与事务方法重定向到扩展客户端，确保历史代码路径也能使用扩展能力
    try {
      const toCamel = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)
      for (const model of ModelNames as readonly string[]) {
        const key = toCamel(model)
        if ((this.extendedClient as any)[key]) {
          ;(this as any)[key] = (this.extendedClient as any)[key]
        }
      }
      if (this.extendedClient && (this.extendedClient as any).$transaction) {
        ;(this as any).$transaction = (this.extendedClient as any).$transaction.bind(
          this.extendedClient,
        )
      }
    } catch (e) {
      this.logger.warn(`重定向扩展客户端失败: ${(e as Error).message}`)
    }
  }

  private setupQueryLogging() {
    const attach = (client: PrismaClient) => {
      const anyClient = client as any
      if (typeof anyClient.$on !== 'function') return
      anyClient.$on('query' as any, (event: any) => {
        const duration = event.duration
        const sql = event.query as string
        const slowMs = this.configService.get<number>('prisma.slowQueryMs', 100)
        const criticalMs = this.configService.get<number>('prisma.criticalSlowQueryMs', 500)
        const isSlowQuery = duration > slowMs
        const isCriticalSlowQuery = duration > criticalMs
        const isOrchestrationQuery = this.isOrchestrationRelatedQuery(sql)
        const inDevDebug = this.env.isDev() || this.env.isDebugMode()
        const summary = `${duration}ms - ${sql.substring(0, 120)}...`

        if (isCriticalSlowQuery) {
          this.logger.error(`🚨 严重慢查询警告: ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (isSlowQuery) {
          this.logger.warn(`⚠️ 慢查询警告: ${summary}`, {
            orchestrationRelated: isOrchestrationQuery,
          })
        } else if (inDevDebug && isOrchestrationQuery) {
          this.logger.debug(`📊 编排查询: ${summary}`)
        }
      })
    }

    attach(this)
    if (this.extendedClient) attach(this.extendedClient)

    this.logger.log('查询性能监控已启用')
  }

  /**
   * 检测查询是否与编排服务相关
   */
  private isOrchestrationRelatedQuery(query: string): boolean {
    const orchestrationTables = ['story', 'character', 'virtualmodel', 'preset', 'contextmemory']
    const lowerQuery = query.toLowerCase()

    return orchestrationTables.some(
      table =>
        lowerQuery.includes(`from "${table}"`) ||
        lowerQuery.includes(`from \`${table}\``) ||
        lowerQuery.includes(`update "${table}"`) ||
        lowerQuery.includes(`update \`${table}\``),
    )
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close()
    })
  }

  /**
   * 获取当前客户端
   * 如果在事务中则返回事务客户端，否则返回Prisma客户端
   */
  getClient(): ExtendedPrismaClient | Prisma.TransactionClient {
    const tx = this.cls.get(TRANSACTION_KEY) as Prisma.TransactionClient
    // 当未处于事务且扩展客户端尚未初始化时，显式将当前实例视为扩展客户端以满足返回类型合同
    return tx || this.extendedClient || (this as unknown as ExtendedPrismaClient)
  }

  /**
   * 在事务中执行函数
   * 支持 REQUIRED 传播行为：如果已存在事务则加入，否则创建新事务
   * @param fn 要在事务中执行的函数
   * @param options 事务选项
   * @param options.maxWait 最大等待时间
   * @param options.timeout 超时时间
   * @param options.isolationLevel 隔离级别
   * @returns 函数的执行结果
   */
  async runInTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    },
  ): Promise<T> {
    // 生成唯一事务标识，用于日志
    const txId = Math.random().toString(36).substring(2, 8)

    // 检查是否已存在事务
    const existingTx = this.cls.get(TRANSACTION_KEY) as Prisma.TransactionClient

    // 如果已存在事务，直接在现有事务中执行（REQUIRED 传播行为）
    if (existingTx) {
      // this.logger.debug(`[TX:${txId}] 加入现有事务`)
      try {
        const result = await fn(existingTx)
        // this.logger.debug(`[TX:${txId}] 在现有事务中执行完成`)
        return result
      } catch (error) {
        // 捕获并记录错误，然后重新抛出确保事务能够正确回滚
        this.logger.error(`[TX:${txId}] 在现有事务中执行失败: ${(error as Error).message}`)
        throw error
      }
    }

    // 不存在事务，创建新事务
    // this.logger.debug(`[TX:${txId}] 创建新事务`)
    const baseClient = (this.extendedClient || this) as ExtendedPrismaClient
    // 测试/E2E 环境放宽事务等待与超时时间，避免外部调用/计费导致的 5s 过期
    const defaultTestOptions =
      this.env.isTest() || this.env.isE2E() ? { maxWait: 10_000, timeout: 20_000 } : undefined
    const txOptions = { ...(defaultTestOptions || {}), ...(options || {}) }

    const execute = () =>
      baseClient.$transaction(async tx => {
        // 在 CLS 上下文中存储事务客户端
        this.cls.set(TRANSACTION_KEY, tx)
        // this.logger.debug(`[TX:${txId}] 新事务已创建并存储在上下文中`)

        try {
          const result = await fn(tx)
          // this.logger.debug(`[TX:${txId}] 新事务执行成功`)
          return result
        } catch (error) {
          // 记录错误信息，随后抛出，Prisma 会自动回滚该事务
          this.logger.error(`[TX:${txId}] 新事务执行失败: ${(error as Error).message}`)
          throw error
        } finally {
          // 只有在这个方法创建的事务中才清除上下文
          // 这样可以确保外层事务的上下文不会被内层事务清除
          this.cls.set(TRANSACTION_KEY, null)
          // this.logger.debug(`[TX:${txId}] 事务上下文已清除`)
        }
      }, txOptions)

    if (this.cls.isActive()) {
      return execute()
    }

    return this.cls.run(() => execute())
  }

  /**
   * 通用分页查询工具
   * @param delegate Prisma 模型代理，如 this.user 或 this.adminRole
   * @param delegate.findMany 查询多条记录的方法
   * @param delegate.count 统计记录数量的方法
   * @param queryOptions 查询条件（可包含 select/include/where 等）
   * @param pagination { skip, take }
   * @param pagination.skip 跳过的记录数
   * @param pagination.take 获取的记录数
   */
  async getPaginatedList<M, A extends { where?: any }>(
    delegate: {
      findMany: (args: A & { skip: number; take: number }) => Promise<M[]>
      count: (args: { where?: A['where'] }) => Promise<number>
    },
    queryOptions: A,
    pagination: { skip: number; take: number },
  ): Promise<[M[], number]> {
    const [items, total] = await Promise.all([
      delegate.findMany({ ...(queryOptions as any), ...pagination }),
      delegate.count({ where: (queryOptions as any).where }),
    ])
    return [items, total]
  }
}
