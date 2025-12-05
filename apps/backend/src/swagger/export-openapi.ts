import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '@/app.module'
import { defaultEnvAccessor, setProcessEnv } from '@/common/env/env.accessor'
import { buildSwaggerDocument } from './swagger.config'

async function exportOpenapi() {
  // Swagger 生成无需真实数据库，跳过 Prisma 连接可加速执行
  if (!defaultEnvAccessor.str('SKIP_PRISMA_CONNECT')) {
    setProcessEnv('SKIP_PRISMA_CONNECT', 'true')
  }

  const app = await NestFactory.create(AppModule, { logger: false })
  const document = buildSwaggerDocument(app)
  const outputDir = join(process.cwd(), '../../dist/openapi')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, 'backend.json')
  writeFileSync(outputPath, JSON.stringify(document, null, 2))
  await app.close()
  console.log(`OpenAPI schema 已导出: ${outputPath}`)
}

exportOpenapi().catch(error => {
  console.error('导出 OpenAPI 失败')
  console.error(error)
  process.exit(1)
})
