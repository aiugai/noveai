import { SystemWalletID } from '@prisma/client'

export interface SystemWalletCompatGroup {
  key: 'aiRevenue' | 'marketing'
  label: string
  primary: SystemWalletID
  legacy: readonly SystemWalletID[]
  monitorAssets: readonly string[]
}

export const SYSTEM_WALLET_COMPAT_GROUPS: readonly SystemWalletCompatGroup[] = [
  {
    key: 'aiRevenue',
    label: '系统 AI 收入',
    primary: SystemWalletID.SYSTEM_AI_REVENUE,
    legacy: [SystemWalletID.SYSTEM_FEE],
    monitorAssets: ['SCORE', 'DIAMOND'],
  },
  {
    key: 'marketing',
    label: '系统营销支出',
    primary: SystemWalletID.SYSTEM_MARKETING,
    legacy: [SystemWalletID.SYSTEM_ACTIVITY],
    monitorAssets: ['SCORE', 'DIAMOND'],
  },
]

export const SYSTEM_WALLET_ID_SET = new Set<string>(Object.values(SystemWalletID))
