import { INestApplication } from '@nestjs/common'
import * as crypto from 'node:crypto'

import { supertestRequest as request } from '../helpers/supertest-compat'
import {
  API_PREFIX,
  bootstrapE2eApp,
  createTestUser,
  TestUserAuthResponse,
} from '../fixtures/fixtures'
import { PrismaService } from '../../src/prisma/prisma.service'
import {
  AssetType,
  PaymentOrderSourceType,
  PaymentOrderStatus,
  RechargePackageStatus,
  SystemWalletID,
} from '@prisma/client'
import { PaymentMethod } from '../../src/modules/payment/enums/payment.method.enum'
import { PaymentService } from '../../src/modules/payment/services/payment.service'
import { PaymentMerchantService } from '../../src/modules/payment/services/payment-merchant.service'
import { SettingsService } from '../../src/modules/settings/services/settings.service'

/** 支付选项响应类型 */
interface PaymentOptionsResponse {
  methods: string[]
  targetAssetCodes: string[]
  settlementCurrency: string
  packages: RechargePackageResponse[]
  exchangeRate: number
}

/** 充值套餐响应类型 */
interface RechargePackageResponse {
  id: string
  displayTitle: string
  badgeLabel: string
  priceAmount: string
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  bonusScore: number
  totalScore: number
  sortOrder: number
}

/** 支付订单响应类型 */
interface PaymentOrderResponse {
  id: string
  userId: string
  amount: string
  currency: string
  channel: string
  status: string
  targetAssetTypeId?: string | null
  targetAssetAmount?: string | null
  exchangeRate?: number | null
  externalOrderId?: string | null
  paymentDetails?: Record<string, unknown>
  expiresAt?: string | null
  createdAt: string
  completedAt?: string | null
}

describe('[TC-PAY-001] PaymentController (e2e)', () => {
  const basePath = `/${API_PREFIX}/payment`
  let app: INestApplication
  let prisma: PrismaService
  let testUser: TestUserAuthResponse
  let scoreAssetType: AssetType
  let testPackageId: string
  let paymentService: PaymentService
  let merchantService: PaymentMerchantService
  let settingsService: SettingsService

  beforeAll(async () => {
    const { app: testingApp, prisma: prismaService } = await bootstrapE2eApp()
    app = testingApp
    prisma = prismaService
    paymentService = app.get(PaymentService)
    merchantService = app.get(PaymentMerchantService)
    settingsService = app.get(SettingsService)

    // 确保 SCORE 资产类型存在
    scoreAssetType = await prisma.assetType.upsert({
      where: { code: 'SCORE' },
      update: {},
      create: {
        code: 'SCORE',
        name: '积分',
        symbol: 'S',
        precision: 6,
        sortOrder: 1,
        isActive: true,
      },
    })

    // 创建测试充值套餐
    const testPackage = await prisma.paymentRechargePackage.create({
      data: {
        name: 'test_package',
        displayTitle: '测试套餐',
        badgeLabel: '测试',
        priceAmount: 10.0,
        priceCurrency: 'USD',
        baseScore: 1000,
        bonusPercent: 10,
        totalScore: 1100,
        sortOrder: 1,
        status: RechargePackageStatus.ACTIVE,
      },
    })
    testPackageId = testPackage.id

    // 创建测试用户
    testUser = await createTestUser(app, 'payment_test')

    // 为测试用户创建钱包
    await prisma.wallet.upsert({
      where: { userId: testUser.user.id },
      update: {},
      create: {
        userId: testUser.user.id,
      },
    })

    // 确保支付配置存在（使用 Mock 渠道进行测试）
    await prisma.systemSetting.upsert({
      where: { key: 'payment.channels.active' },
      update: { value: '"MOCK"' },
      create: {
        key: 'payment.channels.active',
        value: '"MOCK"',
        type: 'string',
        category: 'payment',
        description: '激活的支付渠道',
      },
    })

    await prisma.systemSetting.upsert({
      where: { key: 'payment.methods.active' },
      update: { value: '["WECHAT", "ALIPAY"]' },
      create: {
        key: 'payment.methods.active',
        value: '["WECHAT", "ALIPAY"]',
        type: 'json',
        category: 'payment',
        description: '激活的支付方式',
      },
    })

    await prisma.systemSetting.upsert({
      where: { key: 'payment.exchange.usd_to_cny' },
      update: { value: '7.2' },
      create: {
        key: 'payment.exchange.usd_to_cny',
        value: '7.2',
        type: 'number',
        category: 'payment',
        description: 'USD 转 CNY 汇率',
      },
    })
  })

  afterAll(async () => {
    // 清理测试数据
    if (testUser?.user?.id) {
      // 先删除支付订单
      await prisma.paymentOrder.deleteMany({
        where: { userId: testUser.user.id },
      })

      // 删除钱包
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

    // 删除测试套餐
    if (testPackageId) {
      await prisma.paymentRechargePackage.delete({
        where: { id: testPackageId },
      }).catch(() => {})
    }

    if (app) {
      await app.close()
    }
  })

  describe('GET /payment/options - Get payment options', () => {
    it('[TC-PAY-002] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/options`)
        .expect(401)
    })

    it('[TC-PAY-003] should get payment options for authenticated user', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/options`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      const response = body as PaymentOptionsResponse
      expect(response).toMatchObject({
        methods: expect.any(Array),
        targetAssetCodes: expect.any(Array),
        settlementCurrency: expect.any(String),
        packages: expect.any(Array),
        exchangeRate: expect.any(Number),
      })

      // 验证支付方式列表不为空
      expect(response.methods.length).toBeGreaterThanOrEqual(1)
    })

    it('[TC-PAY-004] should include recharge packages in payment options', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/options`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      const response = body as PaymentOptionsResponse
      expect(response.packages.length).toBeGreaterThanOrEqual(1)

      const testPkg = response.packages.find(p => p.id === testPackageId)
      expect(testPkg).toBeDefined()
      expect(testPkg).toMatchObject({
        displayTitle: '测试套餐',
        badgeLabel: '测试',
        priceAmount: '10.00',
        priceCurrency: 'USD',
        baseScore: 1000,
        bonusPercent: 10,
        totalScore: 1100,
      })
    })
  })

  describe('POST /payment/orders - Create payment order', () => {
    it('[TC-PAY-005] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .send({
          amount: '10.00',
          currency: 'USD',
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
        })
        .expect(401)
    })

    it('[TC-PAY-006] should return 400 for invalid amount format', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          amount: 'invalid',
          currency: 'USD',
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
        })
        .expect(400)

      expect(body.error).toBeDefined()
    })

    it('[TC-PAY-007] should return 400 for invalid currency format', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          amount: '10.00',
          currency: 'invalid',
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
        })
        .expect(400)

      expect(body.error).toBeDefined()
    })

    it('[TC-PAY-008] should create order successfully with package ID', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          amount: '10.00',
          currency: 'USD',
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
          packageId: testPackageId,
        })
        .expect(201)

      const order = body as PaymentOrderResponse
      expect(order).toMatchObject({
        id: expect.any(String),
        userId: testUser.user.id,
        amount: expect.any(String),
        currency: expect.any(String),
        channel: expect.any(String),
        status: expect.stringMatching(/^(PENDING|COMPLETED|FAILED)$/),
        createdAt: expect.any(String),
      })

      // 清理创建的订单
      await prisma.paymentOrder.delete({ where: { id: order.id } }).catch(() => {})
    })

    it('[TC-PAY-009] should return error for package price mismatch', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          amount: '20.00', // 与测试套餐价格不匹配
          currency: 'USD',
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
          packageId: testPackageId,
        })
        .expect(400)

      expect(body.error?.code).toBe('PAYMENT_RECHARGE_PACKAGE_PRICE_MISMATCH')
    })

    it('[TC-PAY-010] should return error for package currency mismatch', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/orders`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          amount: '10.00',
          currency: 'CNY', // 与测试套餐币种不匹配
          method: PaymentMethod.WECHAT,
          targetAssetCode: 'SCORE',
          packageId: testPackageId,
        })
        .expect(400)

      expect(body.error?.code).toBe('PAYMENT_RECHARGE_PACKAGE_CURRENCY_MISMATCH')
    })
  })

  describe('GET /payment/orders - Get order list', () => {
    let createdOrderId: string

    beforeAll(async () => {
      // 创建一个测试订单
      const order = await prisma.paymentOrder.create({
        data: {
          userId: testUser.user.id,
          amount: 72.0, // 10 USD * 7.2 = 72 CNY
          currency: 'CNY',
          channel: 'MOCK',
          status: PaymentOrderStatus.COMPLETED,
          targetAssetTypeId: scoreAssetType.id,
          targetAssetAmount: 1100,
          paymentDetails: {
            requestedMethod: 'WECHAT',
            requested: { amount: '10.00', currency: 'USD' },
            settled: { amount: '72.00', currency: 'CNY', rate: 7.2 },
          },
          completedAt: new Date(),
        },
      })
      createdOrderId = order.id
    })

    afterAll(async () => {
      if (createdOrderId) {
        await prisma.paymentOrder.delete({ where: { id: createdOrderId } }).catch(() => {})
      }
    })

    it('[TC-PAY-011] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/orders`)
        .expect(401)
    })

    it('[TC-PAY-012] should get order list for authenticated user', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/orders`)
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

    it('[TC-PAY-013] should support pagination parameters', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/orders`)
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      expect(body.page).toBe(1)
      expect(body.limit).toBe(5)
      expect(body.items.length).toBeLessThanOrEqual(5)
    })
  })

  describe('GET /payment/orders/:id - Get order details', () => {
    let createdOrderId: string

    beforeAll(async () => {
      // 创建一个测试订单
      const order = await prisma.paymentOrder.create({
        data: {
          userId: testUser.user.id,
          amount: 72.0,
          currency: 'CNY',
          channel: 'MOCK',
          status: PaymentOrderStatus.PENDING,
          targetAssetTypeId: scoreAssetType.id,
          targetAssetAmount: 1100,
        },
      })
      createdOrderId = order.id
    })

    afterAll(async () => {
      if (createdOrderId) {
        await prisma.paymentOrder.delete({ where: { id: createdOrderId } }).catch(() => {})
      }
    })

    it('[TC-PAY-014] should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/orders/${createdOrderId}`)
        .expect(401)
    })

    it('[TC-PAY-015] should get own order details successfully', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`${basePath}/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200)

      const order = body as PaymentOrderResponse
      expect(order).toMatchObject({
        id: createdOrderId,
        userId: testUser.user.id,
        amount: expect.any(String),
        currency: 'CNY',
        channel: 'MOCK',
        status: 'PENDING',
      })
    })

    it('[TC-PAY-016] should not get other user order', async () => {
      // 创建另一个用户
      const otherUser = await createTestUser(app, 'other_payment_test')

      // 尝试用其他用户的 token 访问订单
      await request(app.getHttpServer())
        .get(`${basePath}/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(404)

      // 清理
      await prisma.user.delete({ where: { id: otherUser.user.id } }).catch(() => {})
    })

    it('[TC-PAY-017] should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get(`${basePath}/orders/nonexistent_order_id`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(400) // CUID 格式校验失败返回 400
    })
  })

  describe('POST /payment/callback/:channel - Payment callback', () => {
    /**
     * 注意：WGQPay 回调需要正确的签名验证，包括：
     * - 商户号匹配
     * - MD5 签名验证
     * - 时间戳防重放
     * - Nonce 去重
     *
     * 在 E2E 测试环境中，这些验证需要完整的 payment.wgqpay 配置。
     * 由于签名验证的复杂性，以下测试仅覆盖基本的路由和格式验证。
     * 完整的回调功能测试应在集成测试或手动测试中进行。
     */

    /**
     * 生成 WGQPay 格式的回调负载（用于格式验证测试）
     */
    function createWGQPayCallback(
      merchantOrderId: string,
      externalOrderId: string,
      state: 0 | 1 | 2,
      amount: number,
    ) {
      return {
        merchant_no: 'TEST_MERCHANT',
        merchant_order_id: merchantOrderId,
        platform_order_id: externalOrderId,
        timestamp: String(Date.now()),
        state,
        amount,
        pay_amount: amount,
        code: state === 1 ? 200 : 400,
        message: state === 1 ? 'success' : 'failed',
        sign: 'test_signature', // 测试签名（会被验证拒绝）
      }
    }

    it('[TC-PAY-018] should return 400 for invalid channel', async () => {
      // 尝试使用不存在的渠道
      await request(app.getHttpServer())
        .post(`${basePath}/callback/INVALID_CHANNEL`)
        .send(createWGQPayCallback('test_order', 'test_external', 1, 72))
        .expect(400)
    })

    it('[TC-PAY-019] should return 400 for missing required fields', async () => {
      // 发送不完整的回调负载
      await request(app.getHttpServer())
        .post(`${basePath}/callback/WGQPAY`)
        .send({
          merchant_order_id: 'test_order',
          // 缺少其他必要字段
        })
        .expect(400)
    })

    it('[TC-PAY-020] should return 400 FAIL for WGQPAY callback signature verification failure', async () => {
      // WGQPay 回调签名验证失败时返回 400 + FAIL
      // 这会触发支付网关的重试机制，直到配置正确的签名密钥
      const { text } = await request(app.getHttpServer())
        .post(`${basePath}/callback/WGQPAY`)
        .send(createWGQPayCallback('test_order_id', 'test_external_id', 1, 72))
        .expect(400)

      expect(text).toBe('FAIL')
    })
  })

  describe('Membership recharge integration', () => {
    it('[TC-PAY-021] should grant membership when membership package order completes', async () => {
      const membershipMetadata = {
        type: 'MEMBERSHIP',
        membershipTier: 'SMALL',
        durationDays: 30,
      }

      const membershipPackage = await prisma.paymentRechargePackage.create({
        data: {
          name: `membership_pkg_${Date.now()}`,
          displayTitle: '小月卡（测试）',
          badgeLabel: '小会员',
          priceAmount: 35,
          priceCurrency: 'USD',
          baseScore: 1,
          bonusPercent: 0,
          totalScore: 1,
          sortOrder: 99,
          status: RechargePackageStatus.ACTIVE,
          metadata: membershipMetadata,
        },
      })

      const order = await prisma.paymentOrder.create({
        data: {
          userId: testUser.user.id,
          amount: membershipPackage.priceAmount,
          currency: membershipPackage.priceCurrency,
          channel: 'MOCK',
          status: PaymentOrderStatus.COMPLETED,
          targetAssetTypeId: scoreAssetType.id,
          targetAssetAmount: membershipPackage.totalScore,
          completedAt: new Date(),
          paymentDetails: {
            requestedMethod: PaymentMethod.WECHAT,
            requested: {
              amount: membershipPackage.priceAmount.toFixed(2),
              currency: membershipPackage.priceCurrency,
            },
            package: {
              id: membershipPackage.id,
              name: membershipPackage.name,
              displayTitle: membershipPackage.displayTitle,
              badgeLabel: membershipPackage.badgeLabel,
              priceAmount: membershipPackage.priceAmount.toFixed(2),
              priceCurrency: membershipPackage.priceCurrency,
              baseScore: membershipPackage.baseScore,
              bonusPercent: membershipPackage.bonusPercent,
              bonusScore: membershipPackage.totalScore - membershipPackage.baseScore,
              totalScore: membershipPackage.totalScore,
              metadata: membershipMetadata,
            },
          },
        },
      })

      try {
        // Ensure system deposit wallet has sufficient balance for SCORE
        await prisma.wallet.upsert({
          where: { id: SystemWalletID.SYSTEM_DEPOSIT },
          update: {},
          create: { id: SystemWalletID.SYSTEM_DEPOSIT },
        })
        await prisma.walletAsset.upsert({
          where: {
            walletId_assetTypeId: {
              walletId: SystemWalletID.SYSTEM_DEPOSIT,
              assetTypeId: scoreAssetType.id,
            },
          },
          update: {
            balance: '1000000',
            frozenBalance: '0',
          },
          create: {
            walletId: SystemWalletID.SYSTEM_DEPOSIT,
            assetTypeId: scoreAssetType.id,
            balance: '1000000',
            frozenBalance: '0',
          },
        })

        await (paymentService as any).processSuccessfulPayment(order)

        const membership = await prisma.userMembership.findFirst({
          where: { userId: testUser.user.id, sourceOrderId: order.id },
        })

        expect(membership).toBeTruthy()
        expect(membership?.tier).toBe('SMALL')
        expect(membership?.startAt).toBeInstanceOf(Date)
        expect(membership?.endAt.getTime()).toBeGreaterThan(membership!.startAt.getTime())
      } finally {
        await prisma.userMembership.deleteMany({ where: { sourceOrderId: order.id } })
        await prisma.paymentOrder.delete({ where: { id: order.id } }).catch(() => {})
        await prisma.paymentRechargePackage
          .delete({ where: { id: membershipPackage.id } })
          .catch(() => {})
      }
    })
  })

  describe('External merchant payment (外部支付中心)', () => {
    const testMerchantId = 'test_merchant_e2e'
    const testSecretKey = 'test_secret_key_for_e2e_12345'
    const testCallbackUrl = 'https://example.com/callback'

    /**
     * 生成 HMAC-SHA256 签名
     */
    function generateSignature(
      params: Record<string, string | number | undefined>,
      secretKey: string,
    ): string {
      // 按 key 字典序排列，过滤 undefined
      const sortedKeys = Object.keys(params)
        .filter(k => params[k] !== undefined)
        .sort()
      const queryString = sortedKeys
        .map(k => `${k}=${params[k]}`)
        .join('&')
      return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex')
    }

    /**
     * 获取带测试商户的完整商户配置
     * 合并 seed 数据中的商户配置和测试商户
     */
    async function getMerchantConfigWithTestMerchant() {
      // 读取现有商户配置（可能来自 seed）
      const existing = await prisma.systemSetting.findUnique({
        where: { key: 'external_payment_merchants' },
      })
      let existingConfig: Record<string, unknown> = {}
      if (existing?.value) {
        try {
          existingConfig = JSON.parse(existing.value as string)
        }
        catch {
          existingConfig = {}
        }
      }

      // 合并测试商户
      return {
        ...existingConfig,
        [testMerchantId]: {
          merchant_id: testMerchantId,
          merchant_name: 'E2E Test Merchant',
          secret_key: testSecretKey,
          callback_url: testCallbackUrl,
          enabled: true,
        },
      }
    }

    beforeAll(async () => {
      // 配置测试商户（合并现有配置）
      const merchantConfig = await getMerchantConfigWithTestMerchant()

      // 使用 SettingsService.set() 更新配置，确保内存缓存同步
      await settingsService.set('external_payment_merchants', merchantConfig, {
        type: 'json',
        category: 'payment',
        description: '外部支付商户配置',
      })

      // 清除商户配置缓存，确保测试读取最新配置
      merchantService.clearCache()
    })

    afterAll(async () => {
      // 清理外部订单
      await prisma.paymentOrder.deleteMany({
        where: { merchantId: testMerchantId },
      })
    })

    it('[TC-PAY-EXT-001] should reject external order without signature', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          merchantId: testMerchantId,
          businessOrderId: 'biz_order_001',
          packageId: testPackageId,
          retUrl: 'https://example.com/return',
          timestamp: Math.floor(Date.now() / 1000),
          // 缺少 sign
        })
        .expect(400)

      expect(body.error).toBeDefined()
    })

    it('[TC-PAY-EXT-002] should reject external order with invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          merchantId: testMerchantId,
          businessOrderId: 'biz_order_002',
          packageId: testPackageId,
          retUrl: 'https://example.com/return',
          timestamp,
          sign: 'invalid_signature',
        })
        .expect(403)

      expect(body.error?.code).toBe('EXTERNAL_PAYMENT_INVALID_SIGNATURE')
    })

    it('[TC-PAY-EXT-003] should reject external order with expired timestamp', async () => {
      // 6 分钟前的时间戳（超过 5 分钟限制）
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 360

      const signParams = {
        business_order_id: 'biz_order_003',
        merchant_id: testMerchantId,
        ret_url: 'https://example.com/return',
        timestamp: expiredTimestamp,
      }
      const sign = generateSignature(signParams, testSecretKey)

      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          merchantId: testMerchantId,
          businessOrderId: 'biz_order_003',
          packageId: testPackageId,
          retUrl: 'https://example.com/return',
          timestamp: expiredTimestamp,
          sign,
        })
        .expect(400)

      expect(body.error?.code).toBe('EXTERNAL_PAYMENT_TIMESTAMP_EXPIRED')
    })

    it('[TC-PAY-EXT-004] should create external order with valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const businessOrderId = `biz_order_${Date.now()}`
      const retUrl = 'https://example.com/return'

      const signParams = {
        business_order_id: businessOrderId,
        merchant_id: testMerchantId,
        ret_url: retUrl,
        timestamp,
      }
      const sign = generateSignature(signParams, testSecretKey)

      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          merchantId: testMerchantId,
          businessOrderId,
          packageId: testPackageId,
          retUrl,
          timestamp,
          sign,
        })
        .expect(201)

      // ExternalOrderPublicResponseDto 只返回公开字段，不包含敏感信息
      expect(body).toMatchObject({
        id: expect.any(String),
        businessOrderId,
        status: expect.stringMatching(/^(PENDING|COMPLETED)$/),
        amount: expect.any(String),
        currency: expect.any(String),
        channel: expect.any(String),
        createdAt: expect.any(String),
      })
      // 确认敏感字段不存在
      expect(body.merchantId).toBeUndefined()
      expect(body.sourceType).toBeUndefined()

      // 清理
      await prisma.paymentOrder.delete({ where: { id: body.id } }).catch(() => {})
    })

    it('[TC-PAY-EXT-005] should return same order for idempotent request', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const businessOrderId = `biz_order_idempotent_${Date.now()}`
      const retUrl = 'https://example.com/return'

      const signParams = {
        business_order_id: businessOrderId,
        merchant_id: testMerchantId,
        ret_url: retUrl,
        timestamp,
      }
      const sign = generateSignature(signParams, testSecretKey)

      const payload = {
        merchantId: testMerchantId,
        businessOrderId,
        packageId: testPackageId,
        retUrl,
        timestamp,
        sign,
      }

      // 第一次请求
      const { body: firstResponse } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send(payload)
        .expect(201)

      // 第二次请求（幂等性）- 需要新的时间戳和签名
      const timestamp2 = Math.floor(Date.now() / 1000)
      const signParams2 = {
        business_order_id: businessOrderId,
        merchant_id: testMerchantId,
        ret_url: retUrl,
        timestamp: timestamp2,
      }
      const sign2 = generateSignature(signParams2, testSecretKey)

      const { body: secondResponse } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          ...payload,
          timestamp: timestamp2,
          sign: sign2,
        })
        .expect(201)

      // 应该返回相同的订单 ID
      expect(secondResponse.id).toBe(firstResponse.id)

      // 清理
      await prisma.paymentOrder.delete({ where: { id: firstResponse.id } }).catch(() => {})
    })

    it('[TC-PAY-EXT-006] should reject unknown merchant', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const signParams = {
        business_order_id: 'biz_order_unknown',
        merchant_id: 'unknown_merchant',
        ret_url: 'https://example.com/return',
        timestamp,
      }
      const sign = generateSignature(signParams, 'any_key')

      const { body } = await request(app.getHttpServer())
        .post(`${basePath}/external/orders`)
        .send({
          merchantId: 'unknown_merchant',
          businessOrderId: 'biz_order_unknown',
          packageId: testPackageId,
          retUrl: 'https://example.com/return',
          timestamp,
          sign,
        })
        .expect(404)

      expect(body.error?.code).toBe('EXTERNAL_PAYMENT_MERCHANT_NOT_FOUND')
    })

    describe('GET /payment/external/order-status', () => {
      let testOrderId: string
      let testBusinessOrderId: string

      beforeAll(async () => {
        // 创建一个测试订单
        testBusinessOrderId = `biz_order_status_${Date.now()}`
        const order = await prisma.paymentOrder.create({
          data: {
            amount: 72.0,
            currency: 'CNY',
            channel: 'MOCK',
            status: PaymentOrderStatus.COMPLETED,
            sourceType: PaymentOrderSourceType.EXTERNAL,
            merchantId: testMerchantId,
            businessOrderId: testBusinessOrderId,
            callbackUrl: testCallbackUrl,
            returnUrl: 'https://example.com/return',
            completedAt: new Date(),
          },
        })
        testOrderId = order.id
      })

      afterAll(async () => {
        if (testOrderId) {
          await prisma.paymentOrder.delete({ where: { id: testOrderId } }).catch(() => {})
        }
      })

      it('[TC-PAY-EXT-007] should query order status with valid signature', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const signParams = {
          business_order_id: testBusinessOrderId,
          merchant_id: testMerchantId,
          timestamp,
        }
        const sign = generateSignature(signParams, testSecretKey)

        const { body } = await request(app.getHttpServer())
          .get(`${basePath}/external/order-status`)
          .query({
            merchantId: testMerchantId,
            businessOrderId: testBusinessOrderId,
            timestamp,
            sign,
          })
          .expect(200)

        expect(body).toMatchObject({
          status: 'success',
        })
      })

      it('[TC-PAY-EXT-008] should reject query with invalid signature', async () => {
        const timestamp = Math.floor(Date.now() / 1000)

        const { body } = await request(app.getHttpServer())
          .get(`${basePath}/external/order-status`)
          .query({
            merchantId: testMerchantId,
            businessOrderId: testBusinessOrderId,
            timestamp,
            sign: 'invalid_signature',
          })
          .expect(403)

        expect(body.error?.code).toBe('EXTERNAL_PAYMENT_INVALID_SIGNATURE')
      })
    })

    describe('GET /payment/external/options - Public payment options', () => {
      it('[TC-PAY-EXT-009] should return payment options without authentication', async () => {
        const { body } = await request(app.getHttpServer())
          .get(`${basePath}/external/options`)
          .expect(200)

        expect(body).toMatchObject({
          methods: expect.any(Array),
          targetAssetCodes: expect.any(Array),
          settlementCurrency: expect.any(String),
          packages: expect.any(Array),
          exchangeRate: expect.any(Number),
        })
      })
    })

    describe('GET /payment/external/orders/:id - Public order query', () => {
      let testExternalOrderId: string

      beforeAll(async () => {
        // 创建一个外部测试订单
        const order = await prisma.paymentOrder.create({
          data: {
            amount: 72.0,
            currency: 'CNY',
            channel: 'MOCK',
            status: PaymentOrderStatus.PENDING,
            sourceType: PaymentOrderSourceType.EXTERNAL,
            merchantId: testMerchantId,
            businessOrderId: `biz_order_public_${Date.now()}`,
            callbackUrl: testCallbackUrl,
            returnUrl: 'https://example.com/return',
          },
        })
        testExternalOrderId = order.id
      })

      afterAll(async () => {
        if (testExternalOrderId) {
          await prisma.paymentOrder.delete({ where: { id: testExternalOrderId } }).catch(() => {})
        }
      })

      it('[TC-PAY-EXT-010] should return external order details without authentication (desensitized)', async () => {
        const { body } = await request(app.getHttpServer())
          .get(`${basePath}/external/orders/${testExternalOrderId}`)
          .expect(200)

        // ExternalOrderPublicResponseDto 只返回公开字段，不包含敏感商户信息
        expect(body).toMatchObject({
          id: testExternalOrderId,
          status: 'PENDING',
        })
        // 验证脱敏：不应包含敏感字段
        expect(body).not.toHaveProperty('merchantId')
        expect(body).not.toHaveProperty('sourceType')
        expect(body).not.toHaveProperty('callbackUrl')
        expect(body).not.toHaveProperty('paymentDetails')
        // 验证公开字段存在
        expect(body).toHaveProperty('amount')
        expect(body).toHaveProperty('currency')
        expect(body).toHaveProperty('channel')
        expect(body).toHaveProperty('createdAt')
        // 验证包含 productInfo 用于回调失败时重建 PaymentCenterCallbackDto
        expect(body).toHaveProperty('productInfo')
        if (body.productInfo) {
          expect(body.productInfo).toHaveProperty('id')
          expect(body.productInfo).toHaveProperty('name')
          expect(body.productInfo).toHaveProperty('priceAmount')
          expect(body.productInfo).toHaveProperty('totalScore')
        }
      })

      it('[TC-PAY-EXT-011] should reject query for non-external order', async () => {
        // 创建一个内部订单
        const internalOrder = await prisma.paymentOrder.create({
          data: {
            userId: testUser.user.id,
            amount: 72.0,
            currency: 'CNY',
            channel: 'MOCK',
            status: PaymentOrderStatus.PENDING,
            sourceType: PaymentOrderSourceType.INTERNAL,
          },
        })

        try {
          await request(app.getHttpServer())
            .get(`${basePath}/external/orders/${internalOrder.id}`)
            .expect(404)
        } finally {
          await prisma.paymentOrder.delete({ where: { id: internalOrder.id } }).catch(() => {})
        }
      })

      it('[TC-PAY-EXT-012] should return 400 for invalid CUID format', async () => {
        // 无效的 CUID 格式会被 ParseCuidPipe 拒绝返回 400
        await request(app.getHttpServer())
          .get(`${basePath}/external/orders/invalid_cuid_format`)
          .expect(400)
      })
    })
  })
})
