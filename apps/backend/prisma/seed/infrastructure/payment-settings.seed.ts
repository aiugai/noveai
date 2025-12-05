import { PrismaClient } from '@prisma/client'
import { getEnvironment, SeedEnvironment } from '../utils/environment'

/**
 * 支付系统配置种子数据
 *
 * @description
 * 初始化支付相关的系统配置项到 SystemSetting 表
 * - payment.exchangeRate.USD_CNY: USD 转 CNY 汇率（默认 7.2）
 * - payment.methods.active: 启用的支付方式列表
 * - payment.channels.active: 启用的支付渠道列表
 * - payment.wgqpay.mockEnabled: 是否启用模拟支付（生产环境强制 false）
 *
 * 这些配置可通过管理后台动态修改
 */
export async function seedPaymentSettings(prisma: PrismaClient) {
  const env = getEnvironment()
  // USD->CNY 汇率配置
  await prisma.systemSetting.upsert({
    where: { key: 'payment.exchangeRate.USD_CNY' },
    update: {},
    create: {
      key: 'payment.exchangeRate.USD_CNY',
      value: '7.2',
      type: 'number',
      description: 'USD 转 CNY 汇率，用于前端显示人民币价格',
      category: 'payment',
      isSystem: true,
    },
  })

  // 启用的支付方式
  await prisma.systemSetting.upsert({
    where: { key: 'payment.methods.active' },
    update: {},
    create: {
      key: 'payment.methods.active',
      value: JSON.stringify(['WECHAT', 'ALIPAY', 'CREDIT_CARD']),
      type: 'json',
      description: '启用的支付方式列表',
      category: 'payment',
      isSystem: true,
    },
  })

  // 启用的支付渠道
  await prisma.systemSetting.upsert({
    where: { key: 'payment.channels.active' },
    update: {},
    create: {
      key: 'payment.channels.active',
      value: JSON.stringify(['WGQPAY']),
      type: 'json',
      description: '启用的支付渠道列表',
      category: 'payment',
      isSystem: true,
    },
  })

  // WGQPAY 模拟支付开关（生产环境强制 false）
  const mockEnabled = env !== SeedEnvironment.PRODUCTION
  await prisma.systemSetting.upsert({
    where: { key: 'payment.wgqpay.mockEnabled' },
    update: {},
    create: {
      key: 'payment.wgqpay.mockEnabled',
      value: String(mockEnabled),
      type: 'boolean',
      description: 'WGQPAY 模拟支付开关：启用后跳过第三方 API 调用直接返回成功（仅限非生产环境）',
      category: 'payment',
      isSystem: true,
    },
  })

  console.log(`[seed:payment-settings] ✅ 已初始化支付系统配置 (env=${env}, mockEnabled=${mockEnabled})`)
}
