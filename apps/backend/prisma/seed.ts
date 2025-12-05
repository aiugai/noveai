// Prisma 7 要求显式加载环境变量
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import * as path from 'path'

// 根据 APP_ENV 加载对应环境变量（与 prisma.config.ts 保持一致）
const appEnv = process.env.APP_ENV || 'development'
const rootDir = path.resolve(__dirname, '../../..')
expand(config({ path: path.join(rootDir, `.env.${appEnv}.local`) }))
expand(config({ path: path.join(rootDir, `.env.${appEnv}`) }))

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { generateShortId, getString } from '@ai/shared'
import { seedInfrastructure } from './seed/infrastructure'
import { seedBootstrap } from './seed/bootstrap'
import { getEnvironmentDisplayName } from './seed/utils/environment'
import 'tsconfig-paths/register'

/**
 * Seed 主入口
 *
 * 架构: 数据分层 + 幂等策略
 *
 * - Infrastructure (基础设施): 所有环境都运行,永远幂等
 * - Bootstrap (引导配置): 所有环境都运行,仅补齐缺失数据
 */

// 定义需要自动生成短ID的模型列表
const MODELS_NEEDING_SHORT_ID = [
  'User',
  'UserCredential',
  'UserRole',
  'Role',
  'AdminUser',
  'AdminUserRole',
  'AdminRole',
  'AdminMenu',
  'NewAdminUserRole',
]

// Prisma 7: 使用 driver adapter 创建 PrismaClient
const connectionString = getString('DATABASE_URL', '', process.env) || ''
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const baseClient = new PrismaClient({ adapter })

const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (MODELS_NEEDING_SHORT_ID.includes(model)) {
          const data = args.data as Record<string, unknown>
          if (data && (data as { id?: unknown }).id == null) {
            ;(data as { id: string }).id = generateShortId()
          }
        }
        return query(args)
      },
      async createMany({ model, args, query }) {
        if (MODELS_NEEDING_SHORT_ID.includes(model) && Array.isArray(args.data)) {
          ;(args.data as Array<Record<string, unknown>>).forEach((item) => {
            const hasId = (item as { id?: unknown }).id != null
            if (!hasId) (item as { id: string }).id = generateShortId()
          })
        }
        return query(args)
      },
      async upsert({ model, args, query }) {
        if (MODELS_NEEDING_SHORT_ID.includes(model)) {
          const create = args.create as Record<string, unknown> | undefined
          const hasId = create && (create as { id?: unknown }).id != null
          if (create && !hasId) (create as { id: string }).id = generateShortId()
        }
        return query(args)
      },
    },
  },
})

/**
 * 主种子函数
 *
 * 执行流程:
 * 1. Infrastructure (基础设施) - 所有环境
 * 2. Bootstrap (引导配置) - 根据环境决定
 */
async function main() {
  const env = getEnvironmentDisplayName()
  console.log(`\n🌱 [seed] 环境: ${env}\n`)

  // ==========================================
  // 阶段 1: 基础设施数据 (所有环境都运行)
  // ==========================================
  await seedInfrastructure(prisma as unknown as PrismaClient)

  // ==========================================
  // 阶段 2: 引导配置数据 (所有环境都运行,仅补齐缺失数据)
  // ==========================================
  await seedBootstrap(prisma as unknown as PrismaClient)

  console.log('\n✅ Seed completed successfully\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    // Prisma 7: 关闭连接池
    await pool.end()
  })
