import {
  AppEnv,
  EnvRecord,
  computeAppEnv,
  getBoolean,
  getInt,
  getNumber,
  getString,
} from '@ai/shared'

export interface EnvAccessor {
  appEnv: () => AppEnv
  nodeEnv: () => string
  str: (key: string, defaultValue?: string) => string | undefined
  bool: (key: string, defaultValue?: boolean) => boolean
  int: (key: string, defaultValue?: number) => number
  num: (key: string, defaultValue?: number) => number
  raw: (key: string) => string | undefined
  snapshot: () => EnvRecord
}

type EnvSource = EnvRecord | NodeJS.ProcessEnv | undefined

function resolveEnv(source?: EnvSource): EnvRecord {
  if (source) return source as EnvRecord
  if (typeof globalThis === 'object') {
    const maybeProcess = (globalThis as any)?.process
    if (maybeProcess?.env) return maybeProcess.env as EnvRecord
  }
  return {}
}

export function createEnvAccessor(source?: EnvSource): EnvAccessor {
  const env = resolveEnv(source)

  return {
    appEnv(): AppEnv {
      return computeAppEnv(undefined, env)
    },
    nodeEnv(): string {
      return (getString('NODE_ENV', 'development', env) || 'development').toLowerCase()
    },
    str(key: string, defaultValue?: string): string | undefined {
      return getString(key, defaultValue, env)
    },
    bool(key: string, defaultValue?: boolean): boolean {
      return getBoolean(key, defaultValue ?? false, env)
    },
    int(key: string, defaultValue?: number): number {
      return getInt(key, defaultValue, env)
    },
    num(key: string, defaultValue?: number): number {
      return getNumber(key, defaultValue, env)
    },
    raw(key: string): string | undefined {
      return env[key]
    },
    snapshot(): EnvRecord {
      return { ...env }
    },
  }
}

export const defaultEnvAccessor = createEnvAccessor()

/**
 * 设置 process.env 环境变量（仅在脚本/启动阶段使用）
 * 注意：运行期服务应通过 ConfigModule/EnvService 读取配置
 */
export function setProcessEnv(key: string, value: string): void {
  if (typeof globalThis === 'object') {
    const maybeProcess = (globalThis as any)?.process
    if (maybeProcess?.env) {
      maybeProcess.env[key] = value
    }
  }
}
