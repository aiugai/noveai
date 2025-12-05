import * as winston from 'winston'
import { defaultEnvAccessor } from '@/common/env/env.accessor'

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: string
  contextFilter: string[]
}

/**
 * 解析日志上下文过滤器
 * 从环境变量 LOG_CONTEXT_FILTER 读取,逗号分隔
 * 留空则返回空数组(输出所有 context)
 */
function parseContextFilter(): string[] {
  const filter = defaultEnvAccessor.str('LOG_CONTEXT_FILTER')?.trim()
  if (!filter) {
    return []
  }
  return filter
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
}

/**
 * 全局日志配置对象
 * - LOG_LEVEL: 日志级别,默认值基于环境类型
 * - LOG_CONTEXT_FILTER: 上下文过滤器(逗号分隔),留空则输出所有
 */
export const loggerConfig: LoggerConfig = {
  level: defaultEnvAccessor.str('LOG_LEVEL') || (defaultEnvAccessor.appEnv() === 'production' ? 'warn' : 'debug'),
  contextFilter: parseContextFilter(),
}

/**
 * 创建 context 过滤器 format
 * 基于 LOG_CONTEXT_FILTER 环境变量过滤日志
 *
 * 行为:
 * - LOG_CONTEXT_FILTER 留空 → 输出所有 context
 * - LOG_CONTEXT_FILTER 有值 → 仅输出匹配的 context
 * - 无 context 的日志 → 始终保留(如 bootstrap 日志)
 *
 * @returns Winston format
 */
function createContextFilter() {
  return winston.format((info) => {
    const { contextFilter } = loggerConfig

    // 留空则输出所有
    if (contextFilter.length === 0) {
      return info
    }

    // 无 context 的日志始终保留(如 main.ts bootstrap 日志)
    if (!info.context) {
      return info
    }

    // 仅保留匹配的 context
    if (contextFilter.includes(info.context as string)) {
      return info
    }

    // 不匹配则过滤掉
    return false
  })()
}

/**
 * Winston transports 工厂函数
 * 根据环境返回不同的传输器配置
 *
 * 生产环境:
 * - 输出到 STDOUT(Console transport)
 * - 纯 JSON 格式(无 ANSI 颜色码)
 * - 包含 timestamp、stack trace
 * - 支持 context 过滤
 *
 * 开发环境:
 * - 输出到 Console
 * - 彩色 pretty-print 格式
 * - 人类可读的时间戳格式
 * - 支持 context 过滤
 *
 * @returns Winston transport 数组
 */
export function createWinstonTransports(): winston.transport[] {
  const appEnv = defaultEnvAccessor.appEnv()
  const isProd = appEnv === 'production'
  const isE2E = appEnv === 'e2e' || appEnv === 'test'

  // E2E 测试环境: 完全静默,不输出任何日志
  if (isE2E) {
    return [
      new winston.transports.Console({
        level: 'error', // 设置最高级别
        silent: true, // 完全静默
      }),
    ]
  }

  if (isProd) {
    // 生产环境: STDOUT + 纯 JSON
    return [
      new winston.transports.Console({
        level: loggerConfig.level,
        format: winston.format.combine(
          createContextFilter(), // Context 过滤器(必须放在最前面)
          winston.format.timestamp(), // ISO 8601 格式时间戳
          winston.format.errors({ stack: true }), // 包含错误堆栈
          winston.format.json(), // 纯 JSON,无颜色码
        ),
      }),
    ]
  } else {
    // 开发环境: Console + 彩色 pretty-print
    return [
      new winston.transports.Console({
        level: loggerConfig.level,
        format: winston.format.combine(
          createContextFilter(), // Context 过滤器(必须放在最前面)
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 人类可读时间戳
          winston.format.colorize({ all: true }), // 对所有字段应用颜色
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
            // 构建基础消息
            let output = `${timestamp} ${level}: `

            // 添加上下文(如果有)
            if (context) {
              output += `[${context}] `
            }

            // 添加消息
            output += message

            // 如果有堆栈信息(错误)
            if (stack) {
              output += `\n${stack}`
            }

            // 如果有额外的元数据,将其格式化输出
            const metaKeys = Object.keys(meta)
            if (metaKeys.length > 0) {
              // 过滤掉 ms 等内部字段
              const filteredMeta: Record<string, unknown> = {}
              metaKeys.forEach(key => {
                if (key !== 'ms' && meta[key] !== undefined) {
                  filteredMeta[key] = meta[key]
                }
              })

              if (Object.keys(filteredMeta).length > 0) {
                output += `\n${JSON.stringify(filteredMeta, null, 2)}`
              }
            }

            return output
          }),
        ),
      }),
    ]
  }
}
