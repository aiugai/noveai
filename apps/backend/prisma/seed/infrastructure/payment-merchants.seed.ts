import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'

/**
 * 外部商户配置接口（与 PaymentMerchantService.ExternalMerchantConfig 保持一致）
 */
interface ExternalMerchantConfig {
  merchant_id: string
  merchant_name: string
  secret_key: string
  callback_url: string
  enabled: boolean
}

/**
 * 默认商户定义
 *
 * @description
 * 定义系统内置的默认商户
 * - wallet_recharge: 钱包充值商户
 * - activity_purchase: 活动购买商户
 *
 * 密钥在首次创建时自动生成，后续可通过 admin 后台修改
 */
interface DefaultMerchantDef {
  merchant_id: string
  merchant_name: string
  default_callback_url: string
  enabled: boolean
}

const DEFAULT_MERCHANTS: Record<string, DefaultMerchantDef> = {
  wallet_recharge: {
    merchant_id: 'wallet_recharge',
    merchant_name: '钱包充值',
    default_callback_url: 'http://localhost:3005/api/v1/payment/callback/internal',
    enabled: true,
  },
  activity_purchase: {
    merchant_id: 'activity_purchase',
    merchant_name: '活动购买',
    default_callback_url: 'http://localhost:3005/api/v1/payment/callback/internal',
    enabled: true,
  },
}

/**
 * 支付中心商户配置种子数据
 *
 * @description
 * 为所有环境配置默认外部商户（幂等）
 *
 * 幂等策略：
 * - 不存在的商户：创建新配置，自动生成随机密钥
 * - 已存在的商户：保留现有配置，不覆盖（保护 admin 后台修改）
 *
 * 配置存储在 SystemSetting 表中，key = 'external_payment_merchants'
 * 格式为 JSON 对象：{ "merchant_id": { ...config } }
 */
export async function seedPaymentMerchants(prisma: PrismaClient) {
  const MERCHANTS_CONFIG_KEY = 'external_payment_merchants'

  // 1. 读取现有配置
  const existing = await prisma.systemSetting.findUnique({
    where: { key: MERCHANTS_CONFIG_KEY },
  })

  let existingMerchants: Record<string, ExternalMerchantConfig> = {}
  if (existing?.value) {
    try {
      existingMerchants = JSON.parse(existing.value) as Record<string, ExternalMerchantConfig>
    }
    catch {
      console.warn('[seed:payment-merchants] 现有配置解析失败，将重新初始化')
    }
  }

  // 2. 合并配置：已存在的保留，不存在的新增
  const mergedMerchants: Record<string, ExternalMerchantConfig> = { ...existingMerchants }
  const addedMerchants: string[] = []
  const skippedMerchants: string[] = []

  for (const [merchantId, def] of Object.entries(DEFAULT_MERCHANTS)) {
    if (existingMerchants[merchantId]) {
      // 已存在，跳过（幂等：保护 admin 后台修改）
      skippedMerchants.push(merchantId)
      continue
    }

    // 新增商户，自动生成随机密钥
    mergedMerchants[merchantId] = {
      merchant_id: def.merchant_id,
      merchant_name: def.merchant_name,
      secret_key: generateMerchantSecretKey(),
      callback_url: def.default_callback_url,
      enabled: def.enabled,
    }
    addedMerchants.push(merchantId)
  }

  // 3. 仅当有新增时才写入
  if (addedMerchants.length > 0) {
    await prisma.systemSetting.upsert({
      where: { key: MERCHANTS_CONFIG_KEY },
      update: {
        value: JSON.stringify(mergedMerchants),
        type: 'json',
        description: '外部支付商户配置（JSON 格式）',
        category: 'payment',
      },
      create: {
        key: MERCHANTS_CONFIG_KEY,
        value: JSON.stringify(mergedMerchants),
        type: 'json',
        description: '外部支付商户配置（JSON 格式）',
        category: 'payment',
        isSystem: true,
      },
    })

    console.log(`[seed:payment-merchants] ✅ 新增 ${addedMerchants.length} 个商户: ${addedMerchants.join(', ')}`)
  }

  if (skippedMerchants.length > 0) {
    console.log(`[seed:payment-merchants] ⏭️ 跳过已存在的 ${skippedMerchants.length} 个商户: ${skippedMerchants.join(', ')}`)
  }

  if (addedMerchants.length === 0 && skippedMerchants.length === 0) {
    console.log('[seed:payment-merchants] ℹ️ 无默认商户需要配置')
  }
}

/**
 * 生成随机商户密钥(256-bit)
 *
 * @returns 64位十六进制字符串
 */
export function generateMerchantSecretKey(): string {
  return randomBytes(32).toString('hex')
}
