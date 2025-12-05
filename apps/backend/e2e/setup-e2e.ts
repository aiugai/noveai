import { execSync } from 'node:child_process'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import {
  E2eEnvKey,
  saveEnvSnapshot,
  restoreEnvSnapshot,
  setEnv,
  getEnvStr,
  getEnvBool,
  EnvSnapshot,
} from './fixtures/e2e-env'

// 保存原始环境变量快照
const originalEnvSnapshot: EnvSnapshot = saveEnvSnapshot([
  E2eEnvKey.AUTH_RATE_LIMIT_ENABLED,
  E2eEnvKey.AUTH_GUEST_THROTTLE_FORCE_ENABLE,
])

// 设置测试环境变量
setEnv(E2eEnvKey.AUTH_RATE_LIMIT_ENABLED, 'true')
setEnv(E2eEnvKey.AUTH_GUEST_THROTTLE_FORCE_ENABLE, 'true')

// 全局存储当前测试使用的数据库名称
let currentTestDatabase: string | null = null
let originalDatabaseUrl: string | null = null
const shouldSkipDbSetup = getEnvBool(E2eEnvKey.E2E_SKIP_DB_SETUP, false)
let urlParams: ReturnType<typeof parseDatabaseUrl> | null = null

/**
 * 转义 SQL 标识符 (表名、列名、数据库名等)
 * 使用双引号包裹并转义内部双引号
 */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * 转义 SQL 字符串常量
 * 使用单引号包裹并转义内部单引号
 */
function escapeLiteral(literal: string): string {
  return `'${literal.replace(/'/g, "''")}'`
}

/**
 * 生成唯一的测试数据库名称
 */
function generateTestDatabaseName(): string {
  // 格式: test_db_YYYYMMDDHHmmss_hex
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)
  const randomId = crypto.randomBytes(6).toString('hex')
  return `test_db_${timestamp}_${randomId}`
}

/**
 * 从 DATABASE_URL 中提取连接参数
 */
function parseDatabaseUrl(dbUrl: string): {
  host: string
  port: string
  database: string
  username: string
  password: string
  baseUrl: string
} {
  try {
    const url = new URL(dbUrl)
    const host = url.hostname
    const port = url.port || '5432'
    const database = url.pathname.slice(1) // 移除开头的 '/'
    const username = url.username
    const password = url.password

    // 使用 URL API 构建 baseUrl,自动处理特殊字符编码
    const baseUrlObj = new URL(dbUrl)
    baseUrlObj.pathname = '/postgres'
    const baseUrl = baseUrlObj.toString()

    return { host, port, database, username, password, baseUrl }
  } catch (error) {
    throw new Error(`无效的 DATABASE_URL 格式: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 构建指向指定数据库的 URL
 */
function buildDatabaseUrl(params: {
  username: string
  password: string
  host: string
  port: string
  database: string
}): string {
  // 使用 URL API 自动处理编码
  const url = new URL(`postgresql://${params.host}:${params.port}/`)
  if (params.username) url.username = params.username
  if (params.password) url.password = params.password
  url.pathname = `/${params.database}`
  return url.toString()
}

/**
 * 执行 PostgreSQL 命令
 */
function executePsqlCommand(connectionUrl: string, command: string, silent = false): string {
  try {
    const params = parseDatabaseUrl(connectionUrl)
    const psqlCommand = `PGPASSWORD="${params.password}" psql -h "${params.host}" -p "${params.port}" -U "${params.username}" -d "${params.database}" -t -c "${command}"`

    return execSync(psqlCommand, {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    })
  } catch (error) {
    throw new Error(`执行 PostgreSQL 命令失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 检查数据库权限
 */
function checkDatabasePermissions(baseUrl: string): boolean {
  try {
    const testDbName = `test_permission_check_${Date.now()}`
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(testDbName)}`, true)
    executePsqlCommand(baseUrl, `DROP DATABASE ${escapeIdentifier(testDbName)}`, true)
    return true
  } catch (error) {
    console.error('[E2E setup] 数据库权限检查失败:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 清理超过指定时间的历史数据库
 */
function cleanupOldDatabases(baseUrl: string, maxAgeHours = 24): void {
  // 环境变量控制
  if (!getEnvBool(E2eEnvKey.E2E_CLEANUP_OLD_DB, false)) {
    console.log('[E2E setup] 历史数据库清理已禁用 (E2E_CLEANUP_OLD_DB != true)')
    return
  }

  try {
    console.log(`[E2E setup] 开始清理超过 ${maxAgeHours} 小时的历史 test_db_* ...`)

    // 查询所有 test_db_* 开头的数据库
    const result = executePsqlCommand(
      baseUrl,
      "SELECT datname FROM pg_database WHERE datname LIKE 'test_db_%'",
      true,
    )

    const databases = result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('test_db_'))

    if (databases.length === 0) {
      console.log('[E2E setup] 没有找到需要清理的历史数据库')
      return
    }

    console.log(`[E2E setup] 发现 ${databases.length} 个历史 test_db_*`)

    let cleanedCount = 0
    let skippedCount = 0

    for (const dbName of databases) {
      try {
        // 1. 解析时间戳: test_db_YYYYMMDDHHmmss_xxx
        const match = dbName.match(/^test_db_(\d{14})_[a-f0-9]+$/)
        if (!match) {
          console.log(`[E2E setup] 跳过数据库 ${dbName} (格式不匹配)`)
          skippedCount++
          continue
        }

        // 2. 计算年龄
        const timestampStr = match[1]
        const dbTimestamp = new Date(
          `${timestampStr.slice(0, 4)}-${timestampStr.slice(4, 6)}-${timestampStr.slice(
            6,
            8,
          )}T${timestampStr.slice(8, 10)}:${timestampStr.slice(10, 12)}:${timestampStr.slice(
            12,
            14,
          )}Z`,
        )

        if (isNaN(dbTimestamp.getTime())) {
          console.log(`[E2E setup] 跳过数据库 ${dbName} (时间戳解析失败)`)
          skippedCount++
          continue
        }

        const ageHours = (Date.now() - dbTimestamp.getTime()) / (1000 * 60 * 60)

        if (ageHours < maxAgeHours) {
          console.log(
            `[E2E setup] 跳过数据库 ${dbName} (仅 ${ageHours.toFixed(1)} 小时,未超过 ${maxAgeHours} 小时)`,
          )
          skippedCount++
          continue
        }

        // 3. 检查活动连接
        const activeConnsResult = executePsqlCommand(
          baseUrl,
          `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '${dbName.replace(/'/g, "''")}'`,
          true,
        )
        const activeConns = parseInt(activeConnsResult.trim())

        if (activeConns > 0) {
          console.log(
            `[E2E setup] 跳过数据库 ${dbName} (有 ${activeConns} 个活动连接,可能正在测试中)`,
          )
          skippedCount++
          continue
        }

        // 4. 删除数据库 (无需强制终止连接)
        executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS "${dbName.replace(/"/g, '""')}"`, true)
        console.log(`[E2E setup] 已清理数据库 ${dbName} (年龄: ${ageHours.toFixed(1)} 小时)`)
        cleanedCount++
      } catch (error) {
        console.warn(
          `[E2E setup] 清理数据库 ${dbName} 失败:`,
          error instanceof Error ? error.message : error,
        )
      }
    }

    console.log(
      `[E2E setup] 清理完成: 成功 ${cleanedCount} 个, 跳过 ${skippedCount} 个, 总计 ${databases.length} 个`,
    )
  } catch (error) {
    console.warn(
      '[E2E setup] 清理历史数据库失败(忽略):',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 创建测试数据库并运行迁移
 */
function setupTestDatabase(
  baseUrl: string,
  dbName: string,
  urlParams: ReturnType<typeof parseDatabaseUrl>,
): void {
  try {
    console.log(`[E2E setup] 创建测试数据库: ${dbName}`)

    // 创建数据库
    executePsqlCommand(baseUrl, `CREATE DATABASE ${escapeIdentifier(dbName)}`, true)

    // 构建指向新数据库的 URL
    const testDbUrl = buildDatabaseUrl({
      username: urlParams.username,
      password: urlParams.password,
      host: urlParams.host,
      port: urlParams.port,
      database: dbName,
    })

    console.log(`[E2E setup] 在数据库 ${dbName} 中运行迁移...`)
    console.log(`[E2E setup] 使用 DATABASE_URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`)

    // 运行迁移 - 直接调用 Prisma 确保使用正确的 DATABASE_URL
    const backendDir = path.resolve(__dirname, '..')
    try {
      execSync('npx prisma migrate deploy --schema=./prisma/schema/schema.prisma', {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    } catch (migrateErr) {
      console.error(
        '[E2E setup] 迁移失败:',
        migrateErr instanceof Error ? migrateErr.message : migrateErr,
      )
      throw migrateErr
    }

    // 运行种子数据 - 直接调用 Prisma
    try {
      console.log(`[E2E setup] 在数据库 ${dbName} 中运行种子数据...`)
      execSync('npx prisma db seed --schema=./prisma/schema/schema.prisma', {
        stdio: 'inherit',
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          APP_ENV: 'e2e',
        },
      })
    } catch (seedErr) {
      console.warn(
        '[E2E setup] 种子数据导入失败(忽略,继续执行测试):',
        seedErr instanceof Error ? seedErr.message : seedErr,
      )
    }

    console.log(`[E2E setup] 数据库 ${dbName} 初始化完成`)
  } catch (error) {
    throw new Error(`设置测试数据库失败: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 清理测试数据库
 */
function cleanupTestDatabase(baseUrl: string, dbName: string): void {
  try {
    console.log(`[E2E setup] 清理测试数据库: ${dbName}`)

    // 终止所有到该数据库的连接
    try {
      executePsqlCommand(
        baseUrl,
        `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = ${escapeLiteral(dbName)} AND pid <> pg_backend_pid()`,
        true,
      )
    } catch (_error) {
      // 忽略终止连接的错误
    }

    // 删除数据库
    executePsqlCommand(baseUrl, `DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`, true)
    console.log(`[E2E setup] 数据库 ${dbName} 已清理`)
  } catch (error) {
    console.error(
      `[E2E setup] 清理数据库 ${dbName} 失败:`,
      error instanceof Error ? error.message : error,
    )
  }
}

// ========== 主入口 ==========

if (shouldSkipDbSetup) {
  if (!getEnvStr(E2eEnvKey.DATABASE_URL)) {
    setEnv(E2eEnvKey.DATABASE_URL, 'postgresql://localhost:5432/e2e_dummy')
  }
  const currentDbUrl = getEnvStr(E2eEnvKey.DATABASE_URL) || ''
  if (currentDbUrl && !currentDbUrl.includes('e2e') && !currentDbUrl.includes('test')) {
    setEnv(E2eEnvKey.DATABASE_URL, `${currentDbUrl}#e2e`)
  }
  if (!getEnvStr(E2eEnvKey.SKIP_PRISMA_CONNECT)) {
    setEnv(E2eEnvKey.SKIP_PRISMA_CONNECT, 'true')
  }
  console.warn('[E2E setup] 检测到 E2E_SKIP_DB_SETUP=true，跳过数据库初始化与迁移')
} else {
  // 验证测试数据库URL
  const dbUrl = getEnvStr(E2eEnvKey.DATABASE_URL)
  if (!dbUrl || (!dbUrl.includes('e2e') && !dbUrl.includes('test'))) {
    const maskedUrl = (() => {
      if (!dbUrl) return '(missing)'
      try {
        const u = new URL(dbUrl)
        if (u.password) u.password = '****'
        return u.toString()
      } catch {
        return '(invalid format)'
      }
    })()
    console.error('[E2E setup] 缺少有效的 DATABASE_URL,检测结果:', maskedUrl)
    console.error('[E2E setup] APP_ENV:', getEnvStr(E2eEnvKey.APP_ENV), ' NODE_ENV:', getEnvStr(E2eEnvKey.NODE_ENV))
    process.exit(1)
  }

  // 解析原始 URL 并保存
  urlParams = parseDatabaseUrl(dbUrl)
  originalDatabaseUrl = urlParams.baseUrl

  // 检查数据库权限
  console.log('[E2E setup] 检查数据库 CREATE DATABASE 权限...')
  if (!checkDatabasePermissions(originalDatabaseUrl)) {
    console.error('[E2E setup] ❌ 数据库权限不足,无法创建数据库')
    console.error('[E2E setup] 请确保数据库用户拥有 CREATE DATABASE 权限')
    console.error('[E2E setup] 或者联系管理员授予权限')
    process.exit(1)
  }
  console.log('[E2E setup] ✅ 数据库权限检查通过')

  // 清理历史残留数据库
  cleanupOldDatabases(originalDatabaseUrl, 24)

  // 生成唯一的测试数据库
  currentTestDatabase = generateTestDatabaseName()
  console.log(`[E2E setup] 使用测试数据库: ${currentTestDatabase}`)

  // 构建新的 DATABASE_URL
  const testDbUrl = buildDatabaseUrl({
    username: urlParams.username,
    password: urlParams.password,
    host: urlParams.host,
    port: urlParams.port,
    database: currentTestDatabase,
  })

  // 设置环境变量
  setEnv(E2eEnvKey.DATABASE_URL, testDbUrl)

  // 初始化测试数据库
  try {
    setupTestDatabase(originalDatabaseUrl, currentTestDatabase, urlParams)
  } catch (error) {
    console.error('[E2E setup] 初始化测试数据库失败:', error instanceof Error ? error.message : error)
    // 清理失败的数据库
    if (currentTestDatabase && originalDatabaseUrl) {
      cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)
    }
    process.exit(1)
  }
}

// 注册全局钩子:在所有测试结束后清理数据库
afterAll(async () => {
  if (!shouldSkipDbSetup && currentTestDatabase && originalDatabaseUrl && urlParams) {
    console.log(`[E2E teardown] 开始清理测试数据库: ${currentTestDatabase}`)

    // 确保所有 Prisma 连接已关闭（Prisma 7.x 需要使用 Driver Adapter）
    try {
      const { PrismaClient } = await import('@prisma/client')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { Pool } = await import('pg')
      const dbUrl = getEnvStr(E2eEnvKey.DATABASE_URL) || ''
      const pool = new Pool({ connectionString: dbUrl })
      const adapter = new PrismaPg(pool)
      const prisma = new PrismaClient({ adapter })
      await prisma.$disconnect()
      await pool.end()
    } catch (error) {
      console.warn(
        '[E2E teardown] 断开 Prisma 连接失败(忽略):',
        error instanceof Error ? error.message : error,
      )
    }

    // 等待一小段时间确保连接关闭
    await new Promise(resolve => setTimeout(resolve, 100))

    // 清理数据库
    cleanupTestDatabase(originalDatabaseUrl, currentTestDatabase)

    // 恢复原始 URL
    setEnv(E2eEnvKey.DATABASE_URL, buildDatabaseUrl(urlParams))
    currentTestDatabase = null
    originalDatabaseUrl = null
  }

  // 恢复原始环境变量
  restoreEnvSnapshot(originalEnvSnapshot)
})

// Set test timeout
jest.setTimeout(30000)
