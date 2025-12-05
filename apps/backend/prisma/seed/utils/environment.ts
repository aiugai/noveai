/**
 * Seed 环境管理工具
 *
 * 用于判断当前 Seed 运行环境,并根据环境决定数据处理策略
 */

/**
 * Seed 环境枚举
 */
export enum SeedEnvironment {
  /** 开发环境 */
  DEVELOPMENT = 'dev',
  /** 预发布环境 */
  STAGING = 'staging',
  /** 生产环境 */
  PRODUCTION = 'prod',
  /** E2E 测试环境 */
  E2E = 'e2e',
}

/**
 * 获取当前 Seed 环境
 *
 * 环境优先级:
 * 1. APP_ENV=e2e 或 NODE_ENV=e2e/test → E2E
 * 2. APP_ENV=prod/production → PRODUCTION
 * 3. APP_ENV=staging → STAGING
 * 4. 默认 → DEVELOPMENT
 *
 * @returns 当前环境
 */
export function getEnvironment(): SeedEnvironment {
  const appEnv = (process.env.APP_ENV || '').toLowerCase()
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase()

  // E2E 优先判断 (兼容现有逻辑)
  if (appEnv === 'e2e' || nodeEnv === 'e2e' || nodeEnv === 'test') {
    return SeedEnvironment.E2E
  }

  // 根据 APP_ENV 判断
  switch (appEnv) {
    case 'prod':
    case 'production':
      return SeedEnvironment.PRODUCTION
    case 'staging':
      return SeedEnvironment.STAGING
    case 'dev':
    case 'development':
    default:
      return SeedEnvironment.DEVELOPMENT
  }
}

/**
 * 判断当前环境是否应该运行 Bootstrap 数据
 *
 * Bootstrap 数据 = 配置数据 (支付配置、活动定义、演示用户等)
 *
 * 新策略:
 * - 所有环境都运行 Bootstrap
 * - 由具体 Seed 函数保证幂等性 (仅补齐缺失数据)
 *
 * @returns 是否运行 Bootstrap
 */
export function shouldRunBootstrap(): boolean {
  return true
}

/**
 * 获取环境显示名称 (用于日志)
 */
export function getEnvironmentDisplayName(): string {
  const env = getEnvironment()
  switch (env) {
    case SeedEnvironment.DEVELOPMENT:
      return 'Development'
    case SeedEnvironment.STAGING:
      return 'Staging'
    case SeedEnvironment.PRODUCTION:
      return 'Production'
    case SeedEnvironment.E2E:
      return 'E2E'
    default:
      return 'Unknown'
  }
}
