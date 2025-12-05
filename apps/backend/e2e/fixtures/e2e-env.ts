/**
 * E2E 测试环境变量统一访问工具
 *
 * 提供统一的环境变量读写方法，避免直接散落使用 process.env
 */
import { createEnvAccessor, EnvAccessor } from '../../src/common/env/env.accessor'

/**
 * E2E 环境变量读取器（基于 createEnvAccessor）
 */
export const e2eEnv: EnvAccessor = createEnvAccessor(process.env)

/**
 * E2E 环境变量 Key 枚举，统一管理测试相关的环境变量
 */
export enum E2eEnvKey {
  // 数据库相关
  DATABASE_URL = 'DATABASE_URL',
  SKIP_PRISMA_CONNECT = 'SKIP_PRISMA_CONNECT',
  E2E_SKIP_DB_SETUP = 'E2E_SKIP_DB_SETUP',
  E2E_CLEANUP_OLD_DB = 'E2E_CLEANUP_OLD_DB',

  // 应用环境
  APP_ENV = 'APP_ENV',
  NODE_ENV = 'NODE_ENV',
  TEST_LOG_LEVEL = 'TEST_LOG_LEVEL',

  // 认证限流
  AUTH_RATE_LIMIT_ENABLED = 'AUTH_RATE_LIMIT_ENABLED',
  AUTH_GUEST_THROTTLE_FORCE_ENABLE = 'AUTH_GUEST_THROTTLE_FORCE_ENABLE',

  // 邮件测试
  EMAIL_FIXED_CODE = 'EMAIL_FIXED_CODE',
  JWT_SECRET = 'JWT_SECRET',
}

/**
 * 环境变量快照，用于保存和恢复原始值
 */
export interface EnvSnapshot {
  [key: string]: string | undefined
}

/**
 * 保存指定环境变量的原始值
 */
export function saveEnvSnapshot(keys: E2eEnvKey[]): EnvSnapshot {
  const snapshot: EnvSnapshot = {}
  for (const key of keys) {
    snapshot[key] = process.env[key]
  }
  return snapshot
}

/**
 * 恢复环境变量到快照状态
 */
export function restoreEnvSnapshot(snapshot: EnvSnapshot): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

/**
 * 设置环境变量（统一入口）
 */
export function setEnv(key: E2eEnvKey | string, value: string): void {
  process.env[key] = value
}

/**
 * 删除环境变量（统一入口）
 */
export function deleteEnv(key: E2eEnvKey | string): void {
  delete process.env[key]
}

/**
 * 获取环境变量字符串值
 */
export function getEnvStr(key: E2eEnvKey | string, defaultValue?: string): string | undefined {
  return e2eEnv.str(key, defaultValue)
}

/**
 * 获取环境变量布尔值
 */
export function getEnvBool(key: E2eEnvKey | string, defaultValue = false): boolean {
  return e2eEnv.bool(key, defaultValue)
}

/**
 * 检查是否为测试环境
 */
export function isTestEnvironment(): boolean {
  const appEnv = e2eEnv.str(E2eEnvKey.APP_ENV, '')
  return ['test', 'e2e'].includes(appEnv || '')
}

/**
 * 检查是否为开发或测试环境
 */
export function isDevOrTestEnvironment(): boolean {
  const appEnv = e2eEnv.str(E2eEnvKey.APP_ENV, '')
  return ['test', 'e2e', 'development', 'dev'].includes(appEnv || '')
}

/**
 * 获取测试日志级别
 */
export function getTestLogLevel(): string {
  return (e2eEnv.str(E2eEnvKey.TEST_LOG_LEVEL, 'error') || 'error').toLowerCase()
}

/**
 * 设置默认测试环境变量
 */
export function setupDefaultTestEnv(): void {
  // 确保有 DATABASE_URL
  if (!getEnvStr(E2eEnvKey.DATABASE_URL)) {
    setEnv(E2eEnvKey.DATABASE_URL, 'postgresql://localhost:5432/e2e_dummy')
  }

  // 确保数据库 URL 包含 e2e 或 test 标记
  const dbUrl = getEnvStr(E2eEnvKey.DATABASE_URL) || ''
  if (dbUrl && !dbUrl.includes('e2e') && !dbUrl.includes('test')) {
    setEnv(E2eEnvKey.DATABASE_URL, `${dbUrl}#e2e`)
  }

  // 设置 SKIP_PRISMA_CONNECT
  if (!getEnvStr(E2eEnvKey.SKIP_PRISMA_CONNECT)) {
    setEnv(E2eEnvKey.SKIP_PRISMA_CONNECT, 'true')
  }
}
