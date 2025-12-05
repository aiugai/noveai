import { SystemWalletID } from '@prisma/client'

export interface SystemWalletGroup {
  key: 'revenue' | 'expense' | 'transit' | 'special' | 'legacy'
  label: string
  walletIds: SystemWalletID[]
}

/**
 * 系统钱包元数据配置接口
 */
export interface SystemWalletMetadata {
  /** 中文名称 */
  name: string
  /** 枚举值字符串 */
  code: string
  /** 是否允许手动调整余额 */
  isAdjustable: boolean
}

/**
 * 系统钱包完整元数据配置
 *
 * 调整规则:
 * - 收入类钱包: 不可调整(系统自动计算)
 * - 支出类钱包: 部分可调整(营销、退款可手动调整)
 * - 中转类钱包: 可调整
 * - 特殊类钱包: 可调整
 * - 废弃钱包: 不可调整
 */
export const SYSTEM_WALLET_METADATA: Record<SystemWalletID, SystemWalletMetadata> = {
  // ============ 收入类(系统自动计算,不可手动调整) ============
  [SystemWalletID.SYSTEM_AI_REVENUE]: {
    name: 'AI 收入钱包',
    code: 'SYSTEM_AI_REVENUE',
    isAdjustable: false,
  },
  [SystemWalletID.SYSTEM_GIFT_REVENUE]: {
    name: '打赏收入钱包',
    code: 'SYSTEM_GIFT_REVENUE',
    isAdjustable: false,
  },
  [SystemWalletID.SYSTEM_MARKET_REVENUE]: {
    name: '市场收入钱包',
    code: 'SYSTEM_MARKET_REVENUE',
    isAdjustable: false,
  },

  // ============ 支出类(部分可调整) ============
  [SystemWalletID.SYSTEM_MODEL_PROVIDER_COST]: {
    name: '模型供应商成本钱包',
    code: 'SYSTEM_MODEL_PROVIDER_COST',
    isAdjustable: false, // 自动计费,不可手动调整
  },
  [SystemWalletID.SYSTEM_COMMISSION]: {
    name: '佣金支出钱包',
    code: 'SYSTEM_COMMISSION',
    isAdjustable: false, // 自动计算,不可手动调整
  },
  [SystemWalletID.SYSTEM_MARKETING]: {
    name: '营销支出钱包',
    code: 'SYSTEM_MARKETING',
    isAdjustable: true, // ⭐ 可手动调整,用于营销活动和新用户奖励
  },
  [SystemWalletID.SYSTEM_REFUND]: {
    name: '退款钱包',
    code: 'SYSTEM_REFUND',
    isAdjustable: true, // 可手动调整退款金额
  },

  // ============ 中转类(可调整) ============
  [SystemWalletID.SYSTEM_DEPOSIT]: {
    name: '充值中转钱包',
    code: 'SYSTEM_DEPOSIT',
    isAdjustable: true,
  },
  [SystemWalletID.SYSTEM_WITHDRAW]: {
    name: '提现中转钱包',
    code: 'SYSTEM_WITHDRAW',
    isAdjustable: true,
  },
  [SystemWalletID.SYSTEM_ESCROW_MARKET]: {
    name: '市场托管钱包',
    code: 'SYSTEM_ESCROW_MARKET',
    isAdjustable: true,
  },

  // ============ 特殊类(可调整) ============
  [SystemWalletID.SYSTEM_RISK_RESERVE]: {
    name: '风险准备金钱包',
    code: 'SYSTEM_RISK_RESERVE',
    isAdjustable: true,
  },
  [SystemWalletID.SYSTEM_RECYCLE]: {
    name: '系统回收钱包',
    code: 'SYSTEM_RECYCLE',
    isAdjustable: true,
  },

  // ============ 废弃钱包(不可调整) ============
  [SystemWalletID.SYSTEM_FEE]: {
    name: '费用钱包',
    code: 'SYSTEM_FEE',
    isAdjustable: false,
  },
  [SystemWalletID.SYSTEM_ACTIVITY]: {
    name: '活动钱包',
    code: 'SYSTEM_ACTIVITY',
    isAdjustable: false,
  },
}

export const SYSTEM_WALLET_GROUPS: SystemWalletGroup[] = [
  {
    key: 'revenue',
    label: '收入类钱包',
    walletIds: [
      SystemWalletID.SYSTEM_AI_REVENUE,
      SystemWalletID.SYSTEM_GIFT_REVENUE,
      SystemWalletID.SYSTEM_MARKET_REVENUE,
    ],
  },
  {
    key: 'expense',
    label: '支出类钱包',
    walletIds: [
      SystemWalletID.SYSTEM_MODEL_PROVIDER_COST,
      SystemWalletID.SYSTEM_COMMISSION,
      SystemWalletID.SYSTEM_MARKETING,
      SystemWalletID.SYSTEM_REFUND,
    ],
  },
  {
    key: 'transit',
    label: '中转类钱包',
    walletIds: [
      SystemWalletID.SYSTEM_DEPOSIT,
      SystemWalletID.SYSTEM_WITHDRAW,
      SystemWalletID.SYSTEM_ESCROW_MARKET,
    ],
  },
  {
    key: 'special',
    label: '特殊类钱包',
    walletIds: [SystemWalletID.SYSTEM_RISK_RESERVE, SystemWalletID.SYSTEM_RECYCLE],
  },
  {
    key: 'legacy',
    label: '废弃钱包',
    walletIds: [SystemWalletID.SYSTEM_FEE, SystemWalletID.SYSTEM_ACTIVITY],
  },
]

// 中文名称映射(从元数据自动生成,保持向后兼容)
export const SYSTEM_WALLET_NAMES: Record<SystemWalletID, string> = Object.entries(
  SYSTEM_WALLET_METADATA,
).reduce(
  (acc, [key, value]) => {
    acc[key as SystemWalletID] = value.name
    return acc
  },
  {} as Record<SystemWalletID, string>,
)

// 废弃钱包的迁移目标
export const SYSTEM_WALLET_MIGRATION_TARGETS: Partial<Record<SystemWalletID, SystemWalletID>> = {
  [SystemWalletID.SYSTEM_FEE]: SystemWalletID.SYSTEM_AI_REVENUE,
  [SystemWalletID.SYSTEM_ACTIVITY]: SystemWalletID.SYSTEM_MARKETING,
}
