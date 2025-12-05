import { INestApplication } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp, createTestUser, TestUserAuthResponse } from '../fixtures/fixtures'
import { registerTestAdmin, AdminAuthContext } from '../admin/admin-test.utils'
import { PrismaService } from '../../src/prisma/prisma.service'
import { AssetType, SystemWalletID } from '@prisma/client'

/** 钱包资产响应类型 */
interface WalletAssetResponse {
  assetTypeId: string
  code: string
  balance: string
  frozenBalance: string
  totalBalance: string
}

/** 资产类型响应 */
interface AssetTypeResponse {
  id: string
  code: string
  name: string
  symbol?: string
  precision: number
  isActive: boolean
}

/** 交易记录响应类型 */
interface TransactionResponse {
  id: string
  type: string
  amount: string
  status: string
  assetTypeId: string
  reason?: string
  createdAt: string
}

describe('[TC-AWL-001] AdminWalletController (e2e)', () => {
  const basePath = `/${API_PREFIX}/admin/wallets`
  let app: INestApplication
  let prisma: PrismaService
  let adminAuth: AdminAuthContext
  let testUser: TestUserAuthResponse
  let scoreAssetType: AssetType
  let testWalletId: string

  beforeAll(async () => {
    const { app: testingApp, prisma: prismaService } = await bootstrapE2eApp()
    app = testingApp
    prisma = prismaService

    // 创建管理员用户
    adminAuth = await registerTestAdmin(app)

    // 确保 SCORE 资产类型存在
    scoreAssetType = await prisma.assetType.upsert({
      where: { code: 'SCORE' },
      update: {},
      create: {
        code: 'SCORE',
        name: '积分',
        symbol: 'S',
        precision: 2,
        sortOrder: 1,
        isActive: true,
      },
    })

    // 创建测试用户
    testUser = await createTestUser(app, 'admin_wallet_test')

    // 为测试用户创建钱包和资产
    const wallet = await prisma.wallet.upsert({
      where: { userId: testUser.user.id },
      update: {},
      create: {
        userId: testUser.user.id,
      },
    })
    testWalletId = wallet.id

    await prisma.walletAsset.upsert({
      where: {
        walletId_assetTypeId: {
          walletId: wallet.id,
          assetTypeId: scoreAssetType.id,
        },
      },
      update: {
        balance: 500,
        frozenBalance: 50,
      },
      create: {
        walletId: wallet.id,
        assetTypeId: scoreAssetType.id,
        balance: 500,
        frozenBalance: 50,
      },
    })

    // 确保系统钱包存在
    await prisma.wallet.upsert({
      where: { id: SystemWalletID.SYSTEM_DEPOSIT },
      update: {},
      create: {
        id: SystemWalletID.SYSTEM_DEPOSIT,
        userId: null,
      },
    })

    await prisma.walletAsset.upsert({
      where: {
        walletId_assetTypeId: {
          walletId: SystemWalletID.SYSTEM_DEPOSIT,
          assetTypeId: scoreAssetType.id,
        },
      },
      update: {
        balance: 1000000,
        frozenBalance: 0,
      },
      create: {
        walletId: SystemWalletID.SYSTEM_DEPOSIT,
        assetTypeId: scoreAssetType.id,
        balance: 1000000,
        frozenBalance: 0,
      },
    })
  })

  afterAll(async () => {
    // 清理测试数据
    if (testWalletId) {
      await prisma.walletTransaction.deleteMany({
        where: {
          OR: [{ fromWalletId: testWalletId }, { toWalletId: testWalletId }],
        },
      })
      await prisma.walletAsset.deleteMany({
        where: { walletId: testWalletId },
      })
      await prisma.wallet.deleteMany({
        where: { id: testWalletId },
      })
    }

    if (app) {
      await app.close()
    }
  })

  describe('GET /admin/wallets/users/:userId/wallet - Get user wallet', () => {
    it('[TC-AWL-002] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .expect(401)
    })

    it('[TC-AWL-003] should get user wallet info for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        id: expect.any(String),
        userId: testUser.user.id,
        assets: expect.any(Array),
      })

      const scoreAsset = body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')
      expect(scoreAsset).toBeDefined()
      expect(parseFloat(scoreAsset.balance)).toBe(500)
    })

    it('[TC-AWL-004] should return 404 for non-existent user wallet', async () => {
      const nonExistentUserId = randomUUID()

      await request(app.getHttpServer())
        .get(`${basePath}/users/${nonExistentUserId}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(404)
    })
  })

  describe('GET /admin/wallets/users/:userId/transactions - Get user transactions', () => {
    beforeAll(async () => {
      // 创建一些测试交易记录
      await prisma.walletTransaction.createMany({
        data: [
          {
            toWalletId: testWalletId,
            assetTypeId: scoreAssetType.id,
            amount: 100,
            type: 'RECHARGE',
            status: 'COMPLETED',
            reason: '管理员测试充值',
            uniqueId: `admin-test-recharge-${randomUUID()}`,
            userId: testUser.user.id,
          },
          {
            fromWalletId: testWalletId,
            assetTypeId: scoreAssetType.id,
            amount: 50,
            type: 'CONSUMPTION',
            status: 'COMPLETED',
            reason: '管理员测试消费',
            uniqueId: `admin-test-consume-${randomUUID()}`,
            userId: testUser.user.id,
          },
        ],
      })
    })

    it('[TC-AWL-005] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/transactions`)
        .expect(401)
    })

    it('[TC-AWL-006] should get user transaction records for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/transactions`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        items: expect.any(Array),
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
      })
    })

    it('[TC-AWL-007] should support pagination and filtering', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/transactions`)
        .query({ page: 1, limit: 5, type: 'RECHARGE' })
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body.page).toBe(1)
      expect(body.limit).toBe(5)

      for (const tx of body.items as TransactionResponse[]) {
        expect(tx.type).toBe('RECHARGE')
      }
    })
  })

  describe('POST /admin/wallets/users/deposit - Admin deposit', () => {
    it('[TC-AWL-008] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`${basePath}/users/deposit`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '100',
          reason: '测试充值',
        })
        .expect(401)
    })

    it('[TC-AWL-009] should deposit to user successfully for admin', async () => {
      const uniqueId = `deposit-test-${randomUUID()}`

      // 获取充值前余额
      const beforeWallet = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const beforeBalance = parseFloat(
        beforeWallet.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      // 执行充值
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/users/deposit`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '100',
          reason: '管理员充值测试',
          uniqueId,
        })
        .expect(201)

      expect(body).toMatchObject({
        success: true,
        message: '充值成功',
      })

      // 验证余额增加
      const afterWallet = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const afterBalance = parseFloat(
        afterWallet.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      expect(afterBalance).toBe(beforeBalance + 100)
    })

    it('[TC-AWL-010] should be idempotent for duplicate deposit requests', async () => {
      const uniqueId = `deposit-idempotent-${randomUUID()}`

      // 第一次充值
      await request(app.getHttpServer())
        .post(`${basePath}/users/deposit`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '50',
          reason: '幂等测试',
          uniqueId,
        })
        .expect(201)

      // 获取充值后余额
      const afterFirst = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const balanceAfterFirst = parseFloat(
        afterFirst.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      // 第二次相同充值（应该被幂等处理）
      await request(app.getHttpServer())
        .post(`${basePath}/users/deposit`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '50',
          reason: '幂等测试',
          uniqueId,
        })
        .expect(201)

      // 验证余额没有重复增加
      const afterSecond = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const balanceAfterSecond = parseFloat(
        afterSecond.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      expect(balanceAfterSecond).toBe(balanceAfterFirst)
    })

    it('[TC-AWL-011] should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post(`${basePath}/users/deposit`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .send({
          userId: testUser.user.id,
          // 缺少 assetTypeId 和 amount
        })
        .expect(400)
    })
  })

  describe('POST /admin/wallets/users/withdraw - Admin withdraw', () => {
    it('[TC-AWL-012] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`${basePath}/users/withdraw`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '10',
          reason: '测试提取',
        })
        .expect(401)
    })

    it('[TC-AWL-013] should withdraw from user successfully for admin', async () => {
      const uniqueId = `withdraw-test-${randomUUID()}`

      // 获取提取前余额
      const beforeWallet = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const beforeBalance = parseFloat(
        beforeWallet.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      // 执行提取
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/users/withdraw`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .send({
          userId: testUser.user.id,
          assetTypeId: scoreAssetType.id,
          amount: '10',
          reason: '管理员提取测试',
          uniqueId,
        })
        .expect(201)

      expect(body).toMatchObject({
        success: true,
        message: '提取成功',
      })

      // 验证余额减少
      const afterWallet = await request(app.getHttpServer())
        .get(`${basePath}/users/${testUser.user.id}/wallet`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      const afterBalance = parseFloat(
        afterWallet.body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')?.balance || '0',
      )

      expect(afterBalance).toBe(beforeBalance - 10)
    })
  })

  describe('GET /admin/wallets/statistics/today - Get today statistics', () => {
    it('[TC-AWL-014] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/statistics/today`)
        .expect(401)
    })

    it('[TC-AWL-015] should get today statistics for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/statistics/today`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      // 验证返回结构包含预期字段（实际返回按资产类型分组的统计）
      expect(body).toMatchObject({
        recharge: expect.any(Object),
        withdraw: expect.any(Object),
        commission: expect.any(Object),
        consumption: expect.any(Object),
      })
    })
  })

  describe('GET /admin/wallets/metadata - Get wallet metadata', () => {
    it('[TC-AWL-016] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/metadata`)
        .expect(401)
    })

    it('[TC-AWL-017] should get wallet metadata for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/metadata`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        assetTypes: expect.any(Array),
        systemWallets: expect.any(Array),
      })

      // 验证资产类型列表包含 SCORE
      const scoreType = body.assetTypes.find((a: AssetTypeResponse) => a.code === 'SCORE')
      expect(scoreType).toBeDefined()

      // 验证系统钱包列表不为空
      expect(body.systemWallets.length).toBeGreaterThan(0)
    })
  })

  describe('GET /admin/wallets/system/overview - System wallet overview', () => {
    it('[TC-AWL-018] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/system/overview`)
        .expect(401)
    })

    it('[TC-AWL-019] should get system wallet overview for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/system/overview`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      // 验证返回按分组的结构
      expect(body).toMatchObject({
        revenue: expect.objectContaining({
          groupName: expect.any(String),
          wallets: expect.any(Array),
        }),
        expense: expect.objectContaining({
          groupName: expect.any(String),
          wallets: expect.any(Array),
        }),
        transit: expect.objectContaining({
          groupName: expect.any(String),
          wallets: expect.any(Array),
        }),
        special: expect.objectContaining({
          groupName: expect.any(String),
          wallets: expect.any(Array),
        }),
        legacy: expect.any(Array),
      })

      // 验证至少有一个分组包含钱包数据
      const totalWallets =
        body.revenue.wallets.length +
        body.expense.wallets.length +
        body.transit.wallets.length +
        body.special.wallets.length
      expect(totalWallets).toBeGreaterThan(0)
    })
  })

  describe('GET /admin/wallets/snapshots/trend - Snapshot trend', () => {
    it('[TC-AWL-020] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/snapshots/trend`)
        .expect(401)
    })

    it('[TC-AWL-021] should get snapshot trend for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/snapshots/trend`)
        .query({ groupBy: 'day', timeRange: 7 })
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        trends: expect.any(Array),
      })
    })

    it('[TC-AWL-022] should support grouping by hour', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/snapshots/trend`)
        .query({ groupBy: 'hour', timeRange: 24 })
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        trends: expect.any(Array),
      })
    })
  })

  describe('POST /admin/wallets/snapshots/manual - Manual snapshot creation', () => {
    it('[TC-AWL-023] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`${basePath}/snapshots/manual`)
        .expect(401)
    })

    it('[TC-AWL-024] should create snapshot manually for admin', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/snapshots/manual`)
        .set('Authorization', `Bearer ${adminAuth.token}`)
        .expect(200)

      expect(body).toMatchObject({
        success: true,
        count: expect.any(Number),
        date: expect.any(String),
      })
    })
  })
})
