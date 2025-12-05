import type { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const DEFAULT_ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123'
const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'

export async function seedBootstrap(prisma: PrismaClient) {
  await seedDefaultAdminUser(prisma)
}

async function seedDefaultAdminUser(prisma: PrismaClient) {
  const existing = await prisma.adminUser.findUnique({ where: { username: DEFAULT_ADMIN_USERNAME } })
  if (existing) {
    return
  }

  const superRole = await prisma.adminRole.findUnique({ where: { code: 'super_admin' } })
  const password = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)

  await prisma.adminUser.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      password,
      email: DEFAULT_ADMIN_EMAIL,
      roles: superRole
        ? {
            create: [{ roleId: superRole.id }],
          }
        : undefined,
    },
  })

  console.log(
    `👤 已创建默认管理员 ${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}（请尽快修改密码）`,
  )
}
