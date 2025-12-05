/**
 * 缓存系统常量定义
 *
 * TTL单位说明：
 * - 所有TTL值统一使用【秒】作为单位
 * - CacheService会自动处理单位转换
 * - Redis原生使用秒，cache-manager需要毫秒（由CacheService内部转换）
 */

/**
 * 预定义的TTL时长（单位：秒）
 */
export const CacheTTL = {
  /** 1分钟 */
  ONE_MINUTE: 60,

  /** 5分钟 */
  FIVE_MINUTES: 5 * 60,

  /** 10分钟 */
  TEN_MINUTES: 10 * 60,

  /** 30分钟 */
  THIRTY_MINUTES: 30 * 60,

  /** 1小时 */
  ONE_HOUR: 60 * 60,

  /** 6小时 */
  SIX_HOURS: 6 * 60 * 60,

  /** 12小时 */
  TWELVE_HOURS: 12 * 60 * 60,

  /** 1天 */
  ONE_DAY: 24 * 60 * 60,

  /** 1周 */
  ONE_WEEK: 7 * 24 * 60 * 60,

  /** 1个月（30天） */
  ONE_MONTH: 30 * 24 * 60 * 60,
} as const

/**
 * 缓存键前缀定义
 */
export const CacheKeyPrefix = {
  /** 流式会话前缀 */
  STREAM_SESSION: 'stream:session:',

  /** 用户会话前缀 */
  STREAM_USER: 'stream:user:',

  /** 分布式锁前缀 */
  STREAM_LOCK: 'stream:lock:',

  /** 活动相关分布式锁前缀 */
  ACTIVITY_LOCK: 'activity:lock:',

  /** 中止状态前缀 */
  ABORT_STATE: 'abort:state:',

  /** 通用缓存前缀 */
  GENERAL: 'cache:',

  /** OAuth 一次性票据前缀 */
  OAUTH_TICKET: 'oauth:ticket:',

  /** 用户老用户评分缓存前缀 */
  USER_SENIORITY: 'user:seniority:',
} as const

/**
 * TTL类型定义（秒）
 */
export type TTLInSeconds = number
