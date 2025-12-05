import type { PrismaClient } from '@prisma/client'
import { RechargePackageStatus } from '@prisma/client'

// 纯积分充值套餐
const SCORE_RECHARGE_PACKAGES = [
  {
    name: 'starter',
    displayTitle: '750 积分',
    badgeLabel: '萌新套餐',
    priceAmount: 5.0,
    priceCurrency: 'USD',
    baseScore: 750,
    bonusPercent: 0,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 1,
  },
  {
    name: 'advanced',
    displayTitle: '3000 积分',
    badgeLabel: '进阶套餐',
    priceAmount: 20.0,
    priceCurrency: 'USD',
    baseScore: 3000,
    bonusPercent: 10,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 2,
  },
  {
    name: 'premium',
    displayTitle: '6000 积分',
    badgeLabel: '高阶套餐',
    priceAmount: 40.0,
    priceCurrency: 'USD',
    baseScore: 6000,
    bonusPercent: 20,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 3,
  },
  {
    name: 'vip',
    displayTitle: '7500 积分',
    badgeLabel: '尊享套餐',
    priceAmount: 50.0,
    priceCurrency: 'USD',
    baseScore: 7500,
    bonusPercent: 30,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 4,
  },
]

// 会员套餐（小月卡 / 大月卡）
// 注意：这类套餐在支付成功后会通过 MembershipService 自动为用户开通/续期会员
const MEMBERSHIP_RECHARGE_PACKAGES = [
  {
    name: 'small_membership_monthly',
    displayTitle: '小月卡（30 天会员）',
    badgeLabel: '小月卡',
    priceAmount: 35.0,
    priceCurrency: 'USD',
    // assumption: 小月卡主要卖会员资格，这里仅赠送极少量积分，方便通过现有校验与入账流程
    baseScore: 1,
    bonusPercent: 0,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 5,
    metadata: {
      type: 'MEMBERSHIP',
      membershipTier: 'SMALL',
      durationDays: 30,
    },
  },
  {
    name: 'big_membership_monthly',
    displayTitle: '大月卡（30 天会员）',
    badgeLabel: '大月卡',
    priceAmount: 99.0,
    priceCurrency: 'USD',
    // assumption: 大月卡同理，仅赠送极少量积分
    baseScore: 1,
    bonusPercent: 0,
    status: RechargePackageStatus.ACTIVE,
    sortOrder: 6,
    metadata: {
      type: 'MEMBERSHIP',
      membershipTier: 'BIG',
      durationDays: 30,
    },
  },
]

const RAW_RECHARGE_PACKAGES = [
  ...SCORE_RECHARGE_PACKAGES,
  ...MEMBERSHIP_RECHARGE_PACKAGES,
]

const DEFAULT_RECHARGE_PACKAGES = RAW_RECHARGE_PACKAGES.map(pkg => ({
  ...pkg,
  totalScore: Math.round(pkg.baseScore * (1 + pkg.bonusPercent / 100)),
}))

export async function seedRechargePackages(prisma: PrismaClient) {
  console.log('[seed:infrastructure] 充值套餐...')

  for (const pkg of DEFAULT_RECHARGE_PACKAGES) {
    // 使用 upsert 保证幂等且可并发重入：永不覆盖已有记录，只补齐缺失
    // eslint-disable-next-line no-await-in-loop
    await prisma.paymentRechargePackage.upsert({
      where: { name: pkg.name },
      create: pkg,
      update: {},
    })
  }

  console.log('[seed:infrastructure] 充值套餐检查/创建完成 ✅')
}

export type { PrismaClient }
