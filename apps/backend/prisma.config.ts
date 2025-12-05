import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// 根据 APP_ENV 加载对应环境变量
const appEnv = process.env.APP_ENV || 'development'
const rootDir = path.resolve(__dirname, '../..')

// 按优先级加载环境变量：.local 优先级高于默认
expand(config({ path: path.join(rootDir, `.env.${appEnv}.local`) }))
expand(config({ path: path.join(rootDir, `.env.${appEnv}`) }))

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema',
  migrations: {
    path: './prisma/schema/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
