import { INestApplication } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

import { supertestRequest as request } from '../helpers/supertest-compat'
import { API_PREFIX, bootstrapE2eApp, createTestUser, TestUserAuthResponse } from '../fixtures/fixtures'
import { PrismaService } from '../../src/prisma/prisma.service'
import { AssetType } from '@prisma/client'

/** 钱包资产响应类型 */
interface WalletAssetResponse {
  assetTypeId: string
  code: string
  balance: string
  frozenBalance: string
  totalBalance: string
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

describe('[TC-WAL-001] WalletController (e2e)', () => {
  const basePath = `/${API_PREFIX}/wallets`
  let app: INestApplication
  let prisma: PrismaService
  let testUser: TestUserAuthResponse
  let scoreAssetType: AssetType

  beforeAll(async () => {
    const { app: testingApp, prisma: prismaService } = await bootstrapE2eApp()
    app = testingApp
    prisma = prismaService

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
    testUser = await createTestUser(app, 'wallet_test')

    // 为测试用户创建钱包和资产
    await prisma.wallet.upsert({
      where: { userId: testUser.user.id },
      update: {},
      create: {
        userId: testUser.user.id,
      },
    })

    const wallet = await prisma.wallet.findUnique({
      where: { userId: testUser.user.id },
    })

    if (wallet) {
      await prisma.walletAsset.upsert({
        where: {
          walletId_assetTypeId: {
            walletId: wallet.id,
            assetTypeId: scoreAssetType.id,
          },
        },
        update: {
          balance: 100,
          frozenBalance: 10,
        },
        create: {
          walletId: wallet.id,
          assetTypeId: scoreAssetType.id,
          balance: 100,
          frozenBalance: 10,
        },
      })
    }
  })

  afterAll(async () => {
    // 清理测试数据
    if (testUser?.user?.id) {
      const wallet = await prisma.wallet.findUnique({
        where: { userId: testUser.user.id },
      })
      if (wallet) {
        await prisma.walletTransaction.deleteMany({
          where: {
            OR: [{ fromWalletId: wallet.id }, { toWalletId: wallet.id }],
          },
        })
        await prisma.walletAsset.deleteMany({
          where: { walletId: wallet.id },
        })
        await prisma.wallet.delete({
          where: { id: wallet.id },
        })
      }
    }

    if (app) {
      await app.close()
    }
  })

  describe('GET /wallets/me - Get current user wallet', () => {
    it('[TC-WAL-002] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/me`)
        .expect(401)
    })

    it('[TC-WAL-003] should get wallet info for authenticated user', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/me`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      expect(body).toMatchObject({
        id: expect.any(String),
        userId: testUser.user.id,
        assets: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })

      // 验证资产列表结构
      expect(body.assets.length).toBeGreaterThanOrEqual(1)
      const scoreAsset = body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')
      expect(scoreAsset).toBeDefined()
      expect(scoreAsset).toMatchObject({
        assetTypeId: expect.any(String),
        code: 'SCORE',
        balance: expect.any(String),
        frozenBalance: expect.any(String),
        totalBalance: expect.any(String),
      })
    })

    it('[TC-WAL-004] should have correct wallet balance values', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/me`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      const scoreAsset = body.assets.find((a: WalletAssetResponse) => a.code === 'SCORE')
      expect(scoreAsset).toBeDefined()

      // 验证余额计算正确 (balance=100, frozenBalance=10, total=110)
      const balance = parseFloat(scoreAsset.balance)
      const frozenBalance = parseFloat(scoreAsset.frozenBalance)
      const totalBalance = parseFloat(scoreAsset.totalBalance)

      expect(balance).toBe(100)
      expect(frozenBalance).toBe(10)
      expect(totalBalance).toBe(110)
    })
  })

  describe('GET /wallets/transactions - Get transaction records', () => {
    beforeAll(async () => {
      // 创建一些测试交易记录
      const wallet = await prisma.wallet.findUnique({
        where: { userId: testUser.user.id },
      })

      if (wallet) {
        const transactions = [
          {
            toWalletId: wallet.id,
            assetTypeId: scoreAssetType.id,
            amount: 50,
            type: 'RECHARGE' as const,
            status: 'COMPLETED' as const,
            reason: '测试充值1',
            uniqueId: `test-recharge-${randomUUID()}`,
          },
          {
            toWalletId: wallet.id,
            assetTypeId: scoreAssetType.id,
            amount: 30,
            type: 'RECHARGE' as const,
            status: 'COMPLETED' as const,
            reason: '测试充值2',
            uniqueId: `test-recharge-${randomUUID()}`,
          },
          {
            fromWalletId: wallet.id,
            assetTypeId: scoreAssetType.id,
            amount: 20,
            type: 'CONSUMPTION' as const,
            status: 'COMPLETED' as const,
            reason: '测试消费',
            uniqueId: `test-consume-${randomUUID()}`,
          },
        ]

        for (const tx of transactions) {
          await prisma.walletTransaction.create({ data: tx })
        }
      }
    })

    it('[TC-WAL-005] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .expect(401)
    })

    it('[TC-WAL-006] should get transaction records for authenticated user', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      expect(body).toMatchObject({
        items: expect.any(Array),
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
      })

      expect(body.items.length).toBeGreaterThanOrEqual(1)
    })

    it('[TC-WAL-007] should support pagination parameters', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      expect(body.page).toBe(1)
      expect(body.limit).toBe(2)
      expect(body.items.length).toBeLessThanOrEqual(2)
    })

    it('[TC-WAL-008] should support filtering by transaction type', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .query({ type: 'RECHARGE' })
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      // 所有返回的交易类型应该都是 RECHARGE
      for (const tx of body.items as TransactionResponse[]) {
        expect(tx.type).toBe('RECHARGE')
      }
    })

    it('[TC-WAL-009] should support filtering by asset type', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .query({ assetTypeId: scoreAssetType.id })
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      // 所有返回的交易应该都是指定资产类型
      for (const tx of body.items as TransactionResponse[]) {
        expect(tx.assetTypeId).toBe(scoreAssetType.id)
      }
    })

    it('[TC-WAL-010] should forbid access to other user transaction records', async () => {
      // 创建另一个测试用户
      const otherUser = await createTestUser(app, 'other_wallet_test')

      // 创建另一个用户的钱包
      const otherWallet = await prisma.wallet.upsert({
        where: { userId: otherUser.user.id },
        update: {},
        create: {
          userId: otherUser.user.id,
        },
      })

      // 尝试使用第一个用户的 token 访问第二个用户的钱包交易
      await request(app.getHttpServer())
        .get(`${basePath}/transactions`)
        .query({ fromWalletId: otherWallet.id })
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(403)

      // 清理：按依赖顺序删除
      await prisma.wallet.delete({ where: { id: otherWallet.id } })
      await prisma.user.delete({ where: { id: otherUser.user.id } })
    })
  })
})
