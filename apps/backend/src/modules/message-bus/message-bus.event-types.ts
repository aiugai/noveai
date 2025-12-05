// 基础事件类型（脚手架版精简）

export const AUTH_EVENT = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  ADMIN_LOGGED_IN: 'auth.admin.logged_in',
} as const

export type AuthEventTypeStr = (typeof AUTH_EVENT)[keyof typeof AUTH_EVENT]

// Wallet 事件类型
export const WALLET_EVENT = {
  TRANSACTION_COMPLETED: 'wallet.transaction.completed',
  TRANSACTION_REVERTED: 'wallet.transaction.reverted',
  HOLD_RELEASED: 'wallet.hold.released',
  BALANCE_UPDATED: 'wallet.balance.updated',
} as const

export type WalletEventTypeStr = (typeof WALLET_EVENT)[keyof typeof WALLET_EVENT]

// Payment 事件类型
export const PAYMENT_EVENT = {
  WITHDRAW_REQUESTED: 'payment.withdraw.requested',
  WITHDRAW_APPROVED: 'payment.withdraw.approved',
  WITHDRAW_REJECTED: 'payment.withdraw.rejected',
  WITHDRAW_CALLBACK_RECEIVED: 'payment.withdraw.callback_received',
  DEPOSIT_COMPLETED: 'payment.deposit.completed',
} as const

export type PaymentEventTypeStr = (typeof PAYMENT_EVENT)[keyof typeof PAYMENT_EVENT]

// AI 使用事件类型
export const AI_USAGE_EVENT = {
  USAGE_MEASURED_V1: 'ai.usage.measured.v1',
} as const

export type AIUsageEventTypeStr = (typeof AI_USAGE_EVENT)[keyof typeof AI_USAGE_EVENT]

// Engagement 事件类型（用户参与/活动）
export const ENGAGEMENT_EVENT = {
  RECHARGE_COMPLETED: 'engagement.recharge.completed',
} as const

export type EngagementEventTypeStr = (typeof ENGAGEMENT_EVENT)[keyof typeof ENGAGEMENT_EVENT]
