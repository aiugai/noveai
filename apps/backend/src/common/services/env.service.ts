import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AppEnv,
  EnvRecord,
  computeAppEnv,
  getString as sharedGetString,
  getBoolean as sharedGetBoolean,
  getNumber as sharedGetNumber,
  getInt as sharedGetInt,
  isProd as sharedIsProd,
  isDev as sharedIsDev,
  isTest as sharedIsTest,
  isE2E as sharedIsE2E,
  isAdminDebugEnabled as sharedIsAdminDebugEnabled,
} from '@ai/shared'
import { EnvAccessor, createEnvAccessor } from '../env/env.accessor'

@Injectable()
export class EnvService {
  private readonly logger = new Logger(EnvService.name)

  constructor(private readonly config: ConfigService) {}

  private createEnvRecord(): EnvRecord {
    const cache: Record<string, string | undefined> = {}
    const config = this.config
    return new Proxy(cache, {
      get: (_target, prop: string | symbol) => {
        if (typeof prop !== 'string') return undefined
        if (Object.prototype.hasOwnProperty.call(cache, prop)) {
          return cache[prop]
        }
        const raw = config.get<string>(prop)
        if (raw === undefined || raw === null) {
          cache[prop] = undefined
          return undefined
        }
        const str = String(raw)
        cache[prop] = str
        return str
      },
    }) as EnvRecord
  }

  getAccessor(): EnvAccessor {
    return createEnvAccessor(this.createEnvRecord())
  }

  snapshot(): EnvRecord {
    const accessor = this.getAccessor()
    return accessor.snapshot()
  }

  getNodeEnv(): string {
    const env = this.createEnvRecord()
    return sharedGetString('NODE_ENV', 'development', env)?.toLowerCase() || 'development'
  }

  getAppEnv(): AppEnv {
    return computeAppEnv(undefined, this.createEnvRecord())
  }

  // flags
  isProd(): boolean {
    return sharedIsProd(this.createEnvRecord())
  }

  isDev(): boolean {
    return sharedIsDev(this.createEnvRecord())
  }

  isTest(): boolean {
    return sharedIsTest(this.createEnvRecord())
  }

  isE2E(): boolean {
    return sharedIsE2E(this.createEnvRecord())
  }

  isDebugMode(): boolean {
    return sharedGetBoolean('DEBUG_MODE', false, this.createEnvRecord())
  }

  /** 管理端调试开关（非生产或显式 DEBUG_MODE=true） */
  isAdminDebugEnabled(): boolean {
    return sharedIsAdminDebugEnabled(this.createEnvRecord())
  }

  // typed getters
  getString(key: string, defaultValue?: string): string | undefined {
    return sharedGetString(key, defaultValue, this.createEnvRecord())
  }

  getBoolean(key: string, defaultValue = false): boolean {
    return sharedGetBoolean(key, defaultValue, this.createEnvRecord())
  }

  getNumber(key: string, defaultValue?: number): number {
    return sharedGetNumber(key, defaultValue, this.createEnvRecord())
  }

  getInt(key: string, defaultValue?: number): number {
    return sharedGetInt(key, defaultValue, this.createEnvRecord())
  }

  private clampNumber(value: number, min: number, max: number, label: string): number {
    if (!Number.isFinite(value)) return min
    if (value < min) {
      this.logger.warn(`[Env] ${label} too small: ${value}, clamped to ${min}`)
      return min
    }
    if (value > max) {
      this.logger.warn(`[Env] ${label} too large: ${value}, clamped to ${max}`)
      return max
    }
    return value
  }

  // common thresholds helpers
  orchestrationSlowQueryThreshold(): number {
    const v = this.getInt('ORCHESTRATION_SLOW_QUERY_THRESHOLD', 500)
    return this.clampNumber(v, 50, 60_000, 'ORCHESTRATION_SLOW_QUERY_THRESHOLD')
  }

  orchestrationAlertThreshold(): number {
    const v = this.getInt('ORCHESTRATION_ALERT_THRESHOLD', 1000)
    return this.clampNumber(v, 100, 120_000, 'ORCHESTRATION_ALERT_THRESHOLD')
  }

  tokensAlertThreshold(): number {
    const v = this.getInt('TOKENS_ALERT_THRESHOLD', 200000)
    return this.clampNumber(v, 1_000, 100_000_000, 'TOKENS_ALERT_THRESHOLD')
  }

  costAlertThreshold(): number {
    // cost in SCORE (can be float)
    const v = this.getNumber('COST_ALERT_THRESHOLD', 10)
    return this.clampNumber(v, 0.001, 1_000_000, 'COST_ALERT_THRESHOLD')
  }
}
