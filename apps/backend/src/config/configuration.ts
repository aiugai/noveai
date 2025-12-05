import { registerAs } from '@nestjs/config'
import { defaultEnvAccessor } from '@/common/env/env.accessor'

const env = defaultEnvAccessor

export const appConfig = registerAs('app', () => ({
  appEnv: env.appEnv() || 'development',
  port: env.int('PORT', 3005),
  apiPrefix: env.str('API_PREFIX', 'api/v1'),
  appName: env.str('APP_NAME', '@ai/backend'),
}))

export const databaseConfig = registerAs('database', () => ({
  host: env.str('DB_HOST', 'localhost'),
  port: env.int('DB_PORT', 5432),
  username: env.str('DB_USERNAME', 'postgres'),
  password: env.str('DB_PASSWORD', 'postgres'),
  database: env.str('DB_DATABASE', 'ai_scaffold'),
}))

export const redisConfig = registerAs('redis', () => ({
  url: env.str('REDIS_URL', ''),
  host: env.str('REDIS_HOST', 'localhost'),
  port: env.int('REDIS_PORT', 6379),
  password: env.str('REDIS_PASSWORD', ''),
  db: env.int('REDIS_DB', 0),
  tls: env.bool('REDIS_TLS'),
}))

export const jwtConfig = registerAs('jwt', () => {
  const appEnv = env.appEnv()
  const secret = env.str('JWT_SECRET')
  if (!secret && appEnv !== 'development') {
    throw new Error('JWT_SECRET is required')
  }
  return {
    secret: secret || 'dev_only_secret',
    expiresIn: env.str('JWT_EXPIRES_IN', '30d'),
    accessExpiration: env.int('JWT_ACCESS_EXPIRATION', 2592000),
  }
})

export const httpConfig = registerAs('http', () => ({
  trustProxy: env.bool('HTTP_TRUST_PROXY') || env.bool('TRUST_PROXY'),
  trustProxyHops: env.int('HTTP_TRUST_PROXY_HOPS', 0),
}))

export const rbacConfig = registerAs('rbac', () => ({
  debugMode: env.bool('RBAC_DEBUG'),
}))

export const authRateLimitConfig = registerAs('authRateLimit', () => {
  const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const envEnabled = env.str('AUTH_RATE_LIMIT_ENABLED')
  const appEnv = env.str('APP_ENV') || env.str('NODE_ENV') || 'development'
  const enabled =
    typeof envEnabled === 'string' ? envEnabled.toLowerCase() === 'true' : appEnv === 'production'

  return {
    enabled,
    maxAttempts: parsePositiveInt(env.str('AUTH_RATE_LIMIT_MAX'), 10),
    fallbackMaxAttempts: parsePositiveInt(env.str('AUTH_RATE_LIMIT_FALLBACK_MAX'), 20),
    windowMs: parsePositiveInt(env.str('AUTH_RATE_LIMIT_WINDOW_MS'), 5 * 60 * 1000),
  }
})

export const throttleConfig = registerAs('throttle', () => ({
  ttl: env.int('THROTTLE_TTL', 60),
  limit: env.int('THROTTLE_LIMIT', 30),
  ignoreUserAgents: (env.str('THROTTLE_IGNORE_USER_AGENTS', '') || '').split(',').filter(Boolean),
  skipIf: env.str('THROTTLE_SKIP_IF') || null,
  redisEnabled: env.bool('THROTTLE_REDIS_ENABLE'),
}))

export const messageBusConfig = registerAs('messageBus', () => ({
  backoffDelayMs: env.int('MESSAGEBUS_BACKOFF_DELAY_MS', 1000),
  defaultMode: (env.str('MESSAGEBUS_DEFAULT_MODE', 'volatile') || 'volatile') as
    | 'volatile'
    | 'reliable'
    | 'handshake',
  outbox: {
    pollIntervalMs: env.int('MESSAGEBUS_OUTBOX_POLL_INTERVAL_MS', 500),
    batchSize: env.int('MESSAGEBUS_OUTBOX_BATCH_SIZE', 20),
    maxAttempts: env.int('MESSAGEBUS_OUTBOX_MAX_ATTEMPTS', 6),
    lockTimeoutSec: env.int('MESSAGEBUS_OUTBOX_LOCK_TIMEOUT_SEC', 30),
    baseBackoffMs: env.int('MESSAGEBUS_OUTBOX_BASE_BACKOFF_MS', 1000),
    retainDays: env.int('MESSAGEBUS_OUTBOX_RETAIN_DAYS', 7),
    publishAttempts: env.int('MESSAGEBUS_OUTBOX_PUBLISH_ATTEMPTS', 3),
    candidateFactor: env.int('MESSAGEBUS_OUTBOX_CANDIDATE_FACTOR', 3),
    claimMaxCycles: env.int('MESSAGEBUS_OUTBOX_CLAIM_MAX_CYCLES', 1),
  },
}))

export const prismaConfig = registerAs('prisma', () => ({
  slowQueryMs: env.int('PRISMA_SLOW_QUERY_MS', 100),
  criticalSlowQueryMs: env.int('PRISMA_CRITICAL_SLOW_QUERY_MS', 500),
}))

export const aiConfig = registerAs('ai', () => ({
  uniapi: {
    apiKey: env.str('UNIAPI_API_KEY', ''),
    baseUrl: env.str('UNIAPI_BASE_URL', 'https://api.uniapi.io'),
  },
}))
