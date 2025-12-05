/**
 * 限流相关常量
 *
 * 用于统一管理限流键前缀，避免硬编码并确保测试与生产配置一致性
 */

/**
 * 限流键前缀
 * 注意：此前缀会被添加到 ThrottleRedisService 的 keyPrefix 之后
 * 最终 Redis key 格式：throttle:${safeApp}:${appEnv}::${RATE_LIMIT_KEY_PREFIX}*
 */
export const RATE_LIMIT_KEY_PREFIX = 'rate-limit:' as const

/**
 * 具体限流场景的子前缀
 */
export const RATE_LIMIT_PREFIXES = {
  AUTH: `${RATE_LIMIT_KEY_PREFIX}auth:`,
  AUTH_FALLBACK: `${RATE_LIMIT_KEY_PREFIX}auth-fallback:`,
  EMAIL_VERIFY: `${RATE_LIMIT_KEY_PREFIX}email-verify:`,
  AGENT_APPLY: `${RATE_LIMIT_KEY_PREFIX}agent-apply:`,
} as const

