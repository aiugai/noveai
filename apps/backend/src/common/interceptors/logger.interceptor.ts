import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { EnvService } from '../services/env.service'
import { Observable } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
import { Request, Response } from 'express'
// 引入 v4 版本 chalk
import * as chalk from 'chalk'

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggerInterceptor.name)
  private readonly isProd: boolean // 缓存环境判断结果

  constructor(private readonly env: EnvService) {
    this.isProd = env.isProd() // 应用启动时判断一次
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // E2E 测试环境,直接跳过日志记录
    if (this.env.isE2E()) {
      return next.handle()
    }

    // 跳过流式端点的详细日志（减少噪音）
    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    if (request.url?.includes('/stream')) {
      return next.handle()
    }

    // 根据环境选择不同的日志策略
    if (this.isProd) {
      return this.handleProductionLogging(context, next)
    } else {
      return this.handleDevelopmentLogging(context, next)
    }
  }

  /**
   * 生产环境日志处理:元数据摘要
   * - 记录 method/path/statusCode/duration/traceId
   * - body 大小 > 512 字节时跳过序列化,记录 '<body too large>'
   * - 无颜色码,纯文本/JSON
   */
  private handleProductionLogging(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const now = Date.now()
    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now

        // 优化：仅在必要时序列化 body，避免大 body 的完整序列化开销
        // 策略：先判断 body 是否存在且复杂，再决定是否序列化
        let bodySize: number | string
        const body = request.body

        if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
          // 空对象或无 body
          bodySize = 0
        } else if (typeof body !== 'object') {
          // 非对象类型（罕见情况）
          bodySize = String(body).length
        } else {
          // 有内容的对象：先粗略估算键的数量和嵌套深度
          const keyCount = Object.keys(body).length

          // 启发式判断：超过 50 个键大概率是大 body
          if (keyCount > 50) {
            bodySize = `>${512}` // 标记为超大，跳过序列化
          } else {
            // 小对象：安全序列化并计算实际大小
            try {
              const bodyStr = JSON.stringify(body)
              const actualSize = Buffer.byteLength(bodyStr, 'utf8')
              bodySize = actualSize > 512 ? `${actualSize}` : actualSize
            } catch {
              bodySize = 'unstringifiable'
            }
          }
        }

        // 构建日志对象
        const logData = {
          method: request.method,
          path: request.url,
          statusCode: response.statusCode,
          duration: `${duration}ms`,
          traceId: request.headers['x-request-id'] || 'N/A',
          bodySize,
        }

        // 直接传递对象,让 Winston 的 json formatter 处理序列化
        // 避免双重 JSON 编码 (winston.format.json() 已配置)
        this.logger.log(logData)
      }),
      catchError(error => {
        const duration = Date.now() - now
        const statusCode = error.status || 500

        const errorData = {
          method: request.method,
          path: request.url,
          statusCode,
          duration: `${duration}ms`,
          traceId: request.headers['x-request-id'] || 'N/A',
          message: error.message,
          stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace',
        }

        // 直接传递对象,让 Winston 的 json formatter 处理序列化
        this.logger.error(errorData)
        throw error
      }),
    )
  }

  /**
   * 开发环境日志处理:完整日志
   * - 保持现有逻辑(彩色输出 + 完整 body/headers/query)
   * - 无变更
   */
  private handleDevelopmentLogging(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const now = Date.now()
    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    const requestMethod = chalk.bold.blue(request.method)
    const requestUrl = chalk.bold.green(request.originalUrl || request.url)

    // 请求日志(先做敏感字段脱敏后再截断)
    const safeHeaders = this.sanitizeObject(request.headers, true)
    const safeBody = this.sanitizeObject(request.body)
    const safeQuery = this.sanitizeObject(request.query)
    this.logger.log(
      `\n${chalk.cyan.bold('=== Request ===')}\n${chalk.blue('➡️')} ${requestMethod} ${requestUrl}\n${chalk.yellow('Headers:')} ${chalk.gray(this.truncateObject(safeHeaders))}\n${chalk.yellow('Body:')} ${chalk.gray(this.truncateObject(safeBody))}\n${chalk.yellow('Query:')} ${chalk.gray(this.truncateObject(safeQuery))}\n${chalk.cyan.bold('===============')}`,
    )

    return next.handle().pipe(
      tap(data => {
        const delay = Date.now() - now
        const statusColor = this.getStatusColor(response.statusCode)
        const safeRespBody = this.sanitizeObject(data)
        this.logger.log(
          `\n${chalk.cyan.bold('=== Response ===')}\n${chalk.blue('➡️')} ${requestMethod} ${requestUrl}\n${statusColor(`${response.statusCode}`)} ${chalk.magenta(`${delay}ms`)}\n${chalk.yellow('Body:')} ${chalk.gray(this.truncateObject(safeRespBody))}\n${chalk.cyan.bold('================')}`,
        )
      }),
      catchError(error => {
        const delay = Date.now() - now
        const statusCode = error.status || 500
        const statusColor = this.getStatusColor(statusCode)
        this.logger.error(
          `\n${chalk.red.bold('=== Error ===')}\n${chalk.blue('➡️')} ${requestMethod} ${requestUrl}\n${statusColor(`${statusCode}`)} ${chalk.magenta(`${delay}ms`)}\n${chalk.yellow('Message:')} ${chalk.red(error.message)}\n${chalk.yellow('Stack:')} ${chalk.gray(error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace')}\n${chalk.red.bold('=============')}`,
        )
        throw error
      }),
    )
  }

  private getStatusColor(status: number): any {
    if (status >= 500) return chalk.red.bold
    if (status >= 400) return chalk.yellow.bold
    if (status >= 300) return chalk.cyan.bold
    if (status >= 200) return chalk.green.bold
    return chalk.white
  }

  private truncateObject(obj: any): string {
    if (!obj) return 'null'
    try {
      const str = JSON.stringify(obj)
      return str.length > 1000 ? `${str.substring(0, 1000)}... (truncated)` : str
    } catch {
      return '[Object cannot be stringified]'
    }
  }

  // 对 headers/body/query 做敏感字段脱敏
  private sanitizeObject(input: any, isHeader = false): any {
    if (!input || typeof input !== 'object') return input
    const sensitiveHeaderKeys = new Set([
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-auth-token',
    ])
    const sensitiveFieldKeys = new Set([
      'password',
      'pass',
      'newPassword',
      'oldPassword',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'email',
      'phone',
      'mobile',
      'code',
      'verificationCode',
    ])

    const maskString = (v: string) => {
      if (!v) return v
      if (v.length <= 8) return '*'.repeat(Math.max(0, v.length - 2)) + v.slice(-2)
      return `${v.slice(0, 4)}****${v.slice(-4)}`
    }

    const maskEmail = (v: string) => {
      const idx = v.indexOf('@')
      if (idx <= 1) return `*${v.slice(idx)}`
      return `${v[0]}****${v.slice(idx)}`
    }

    const maskPhone = (v: string) => {
      const digits = v.replace(/\D/g, '')
      if (digits.length < 7) return maskString(v)
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`
    }

    const walker = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(walker)
      if (obj && typeof obj === 'object') {
        const out: any = Array.isArray(obj) ? [] : {}
        for (const [key, rawVal] of Object.entries(obj)) {
          const k = key.toLowerCase()
          const val: any = rawVal
          if (val && typeof val === 'object') {
            out[key] = walker(val)
            continue
          }
          if ((isHeader && sensitiveHeaderKeys.has(k)) || sensitiveFieldKeys.has(key)) {
            const strVal = String(val ?? '')
            if (k === 'authorization') out[key] = maskString(strVal)
            else if (key === 'email') out[key] = maskEmail(strVal)
            else if (key === 'phone' || key === 'mobile') out[key] = maskPhone(strVal)
            else out[key] = maskString(strVal)
          } else {
            out[key] = val
          }
        }
        return out
      }
      return obj
    }

    return walker(input)
  }
}
