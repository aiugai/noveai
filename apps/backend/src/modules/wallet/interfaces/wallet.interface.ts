import { TransactionStatus, TransactionType } from '@prisma/client'

export interface IWallet {
  id: string
  userId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IAssetType {
  id: string
  code: string
  name: string
  description?: string
  metadata?: Record<string, any>
  isActive: boolean
  sortOrder?: number
  createdAt: Date
  updatedAt: Date
}

export interface IWalletAsset {
  id: string
  walletId: string
  assetTypeId: string
  // 可用余额（对应 Prisma 模型字段 balance）
  balance: string
  frozenBalance: string
  createdAt: Date
  updatedAt: Date
}

export interface ITransaction {
  id: string
  fromWalletId: string
  toWalletId: string
  assetTypeId: string
  amount: string
  type: TransactionType
  status: TransactionStatus
  reason?: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
