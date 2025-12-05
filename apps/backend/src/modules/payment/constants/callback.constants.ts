/**
 * 回调队列名称
 */
export const PAYMENT_CALLBACK_QUEUE = 'payment-callback'

/**
 * 回调重试任务数据
 */
export interface CallbackRetryJobData {
  orderId: string
  attempt: number
}

/**
 * 重试延迟配置（毫秒）
 * 第1次重试: 1分钟后
 * 第2次重试: 5分钟后
 * 第3次重试: 15分钟后
 */
export const RETRY_DELAYS = [
  1 * 60 * 1000, // 1 分钟
  5 * 60 * 1000, // 5 分钟
  15 * 60 * 1000, // 15 分钟
]

/**
 * 最大重试次数
 */
export const MAX_RETRY_ATTEMPTS = 3
