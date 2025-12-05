import * as crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import winston from 'winston'
import { EnvRecord } from '@ai/shared'
import { createEnvAccessor } from '@/common/env/env.accessor'

const scryptAsync = promisify(crypto.scrypt)

/**
 * 延迟执行
 * @param ms 延迟时间（毫秒）
 * @returns 延迟执行的 Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * 哈希密码
 * @param password 密码
 * @returns 哈希值
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * 验证密码
 * @param password 密码
 * @param hash 哈希值
 * @returns 如果密码匹配，则返回 true，否则返回 false
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return key === derivedKey.toString('hex')
}

/**
 * 获取环境文件路径
 * @param dest 目标路径
 * @returns 环境文件路径
 */
export function getEnvPath(dest: string, envSource?: EnvRecord | NodeJS.ProcessEnv): string {
  const accessor = createEnvAccessor(envSource)
  const env = accessor.appEnv() || 'development'

  // 优先查找根目录的环境变量文件
  const rootDir = process.cwd()
  const possiblePaths = [
    path.resolve(rootDir, `.env.${env}`),
    path.resolve(rootDir, `.env.${env}.local`),
    path.resolve(dest, `.env.${env}.local`),
    path.resolve(rootDir, '.env'),
    path.resolve(process.cwd(), `.env.${env}`),
    path.resolve(process.cwd(), 'dist', `.env.${env}`),
    path.resolve(__dirname, '..', `.env.${env}`),
    path.resolve(dest, `.env.${env}`),
  ]

  const existingPath = possiblePaths.find(filePath => fs.existsSync(filePath))

  if (!existingPath) {
    console.warn(`No env file found, tried: ${possiblePaths.join(', ')}`)
    return path.resolve(rootDir, `.env.${env}`)
  }

  console.log(`Using env file: ${existingPath}`)
  return existingPath
}

/**
 * kebab-case 转 camelCase
 */
export function kebabToCamelCase(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .split('-')
    .map((word, idx) =>
      idx === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
}

/**
 * 日志过滤器
 */
export function createLevelFilter(level: string) {
  return winston.format(info => (info.level === level ? info : false))()
}

/**
 * 日志选项
 */
export function createLoggerOptions(
  type: string,
  logDir: string,
  envSource?: EnvRecord | NodeJS.ProcessEnv,
) {
  const accessor = createEnvAccessor(envSource)
  const serverPort = accessor.str('NEST_SERVER_PORT')
  return {
    level: type,
    dirname: path.join(logDir, type),
    filename: `[${serverPort ?? '-'}]-[${type}]-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '1m',
    maxFiles: '14d',
  }
}

/**
 * 默认日志格式
 */
export function defaultLogFormat(hasFilter = false, level: string = 'http') {
  const commonFormats = [
    winston.format.timestamp({
      format: () => new Date().toISOString().replace('T', ' ').substring(0, 19),
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf((info: any) => {
      const prefix = `[Nest] ${process.pid}  - `
      const timestamp = `${info.timestamp}`
      const context = info.context ? ` [${info.context}] ` : ' '
      const message = info.message
      const stack = info.stack

      let levelColor = info.level.toUpperCase()
      switch (info.level) {
        case 'error':
          levelColor = `\x1B[31m${levelColor}\x1B[0m`
          break
        case 'warn':
          levelColor = `\x1B[33m${levelColor}\x1B[0m`
          break
        case 'info':
          levelColor = `\x1B[32m${levelColor}\x1B[0m`
          break
        case 'http':
          levelColor = `\x1B[36m${levelColor}\x1B[0m`
          break
        case 'debug':
          levelColor = `\x1B[34m${levelColor}\x1B[0m`
          break
        default:
          levelColor = `\x1B[37m${levelColor}\x1B[0m`
      }

      let output = `${prefix}${timestamp}     ${levelColor}${context}${message}`

      // 如果有堆栈信息（错误）
      if (stack) {
        output += `\n${stack}`
      }

      // 处理额外的元数据（如传递给 logger.debug 的对象参数）
      const {
        timestamp: _timestamp,
        level: _level,
        message: _message,
        ms: _ms,
        context: _context,
        stack: _stack,
        ...meta
      } = info
      const metaKeys = Object.keys(meta)
      if (metaKeys.length > 0) {
        // 过滤掉内部字段
        const filteredMeta = {}
        metaKeys.forEach(key => {
          if (meta[key] !== undefined) {
            filteredMeta[key] = meta[key]
          }
        })

        if (Object.keys(filteredMeta).length > 0) {
          output += `\n${JSON.stringify(filteredMeta, null, 2)}`
        }
      }

      return output
    }),
  ]
  return winston.format.combine(...(hasFilter ? [createLevelFilter(level)] : []), ...commonFormats)
}

export interface QueryFilterOptions<T extends string, V> {
  field: T
  value?: V
  isFuzzy?: boolean
}

/**
 * 创建单字段查询条件
 */
export function createSingleFieldFilter<T extends string, V>({
  field,
  value,
  isFuzzy = false,
}: QueryFilterOptions<T, V>) {
  if (value === undefined || value === null || value === '') return {}
  return {
    [field]: isFuzzy ? { contains: value, mode: 'insensitive' } : value,
  } as any
}

/**
 * 多关键词（逗号分隔）模糊查询
 */
export function createCommaSearchFilter<T extends string>(field: T, value?: string) {
  if (!value) return {}
  const keywords = value
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
  return {
    OR: keywords.map(keyword => ({
      [field]: { contains: keyword, mode: 'insensitive' },
    })),
  } as any
}

/**
 * 创建分页参数
 */
export function createPaginationParams(rawPage: number, rawPageSize: number) {
  const page = Math.max(1, rawPage)
  const pageSize = Math.max(1, rawPageSize)
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export type TreeNode<T> = T & { children?: TreeNode<T>[] }

/**
 * 扁平数据转树结构
 */
export function convertFlatDataToTree<
  T extends { id: string; parentId?: string | null; sort: number },
>(flatData: T[], rootId?: string): TreeNode<T>[] {
  const map: Record<string, TreeNode<T>> = {}
  const roots: TreeNode<T>[] = []

  flatData.forEach(item => {
    map[item.id] = { ...item, children: [] }
  })

  flatData.forEach(item => {
    const treeItem = map[item.id]
    if (item.parentId && (!rootId || item.parentId !== rootId)) {
      const parent = map[item.parentId]
      parent && parent.children && parent.children.push(treeItem)
    } else {
      roots.push(treeItem)
    }
  })

  const sortTree = (nodes: TreeNode<T>[]) => {
    nodes.sort((a, b) => a.sort - b.sort)
    nodes.forEach(node => {
      if (node.children && node.children.length) sortTree(node.children)
    })
  }
  sortTree(roots)
  return roots
}
