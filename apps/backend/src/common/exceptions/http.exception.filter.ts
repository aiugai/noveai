import { ArgumentsHost, ExceptionFilter, Catch, HttpException, HttpStatus, Logger, Inject  } from '@nestjs/common'
import { Request, Response } from 'express'
import { I18nService } from 'nestjs-i18n'
import { DomainException } from './domain.exception'
import { randomUUID } from 'node:crypto'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  constructor(
    @Inject(I18nService)
    private readonly i18n: I18nService,
  ) {}

  /**
   * 脱敏敏感请求头
   * 移除或掩码常见的敏感信息字段
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token', 'x-csrf-token']
    const sanitized = { ...headers }

    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]'
      }
      // 处理小写、大写、驼峰等变体
      const lowerKey = key.toLowerCase()
      if (sanitized[lowerKey]) {
        sanitized[lowerKey] = '[REDACTED]'
      }
    }

    return sanitized
  }

  /**
   * 限制请求体输出长度
   * 避免日志过大，仅保留前 500 字符
   * 
   * @param body 请求体对象
   * @returns 安全的字符串表示
   */
  private sanitizeBody(body: unknown): string {
    if (!body) {
      return '{}'
    }

    try {
      const bodyStr = JSON.stringify(body)
      const maxLength = 500

      if (bodyStr.length > maxLength) {
        return `${bodyStr.slice(0, maxLength)}... [truncated, total ${bodyStr.length} chars]`
      }

      return bodyStr
    } catch (_error) {
      // 处理循环引用或其他序列化错误
      return '[Failed to serialize body]'
    }
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()
    const errorResponse = exception.getResponse()
    const lang = request.headers['accept-language'] || 'zh-CN'

    // 为403和401错误记录详细信息
    if (status === HttpStatus.FORBIDDEN || status === HttpStatus.UNAUTHORIZED) {
      const logKey = status === HttpStatus.FORBIDDEN ? 'logging.forbidden' : 'logging.unauthorized'
      this.logger.warn(
        `${this.i18n.translate(logKey, { lang })} - ${request.method} ${request.url}`,
        {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          body: this.sanitizeBody(request.body),
          headers: this.sanitizeHeaders(request.headers),
          error: errorResponse,
          user: request.user,
        },
      )
    }

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(
        `${this.i18n.translate('logging.exception', { lang })} - ${request.method} ${request.url}`,
        exception.stack,
      )
    } else {
      this.logger.warn(
        `${this.i18n.translate('logging.exception', { lang })} - ${status} ${request.method} ${request.url}`,
      )
      this.logger.warn(
        `${this.i18n.translate('logging.requestBody', { lang })}: ${this.sanitizeBody(request.body)}`,
      )
      this.logger.warn(
        `${this.i18n.translate('logging.requestHeaders', { lang })}: ${JSON.stringify(this.sanitizeHeaders(request.headers))}`,
      )
      this.logger.warn(
        `${this.i18n.translate('logging.errorResponse', { lang })}: ${JSON.stringify(errorResponse)}`,
      )
    }

    // 构建响应体：支持 DomainException 的统一错误码结构
    const requestId = randomUUID()
    const responseBody: Record<string, unknown> = {
      status,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    const resolveMessage = (): string => {
      if (typeof errorResponse === 'object' && errorResponse !== null) {
        const errObj = errorResponse as Record<string, unknown>
        if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
          return errObj.message
        }
      } else if (typeof errorResponse === 'string' && errorResponse.trim().length > 0) {
        return errorResponse
      }

      return exception.message
    }

    if (exception instanceof DomainException) {
      responseBody.error = {
        code: exception.code,
        args: exception.args,
        requestId,
      }
    } else if (typeof errorResponse === 'object' && errorResponse !== null) {
      const errObj = errorResponse as Record<string, unknown>
      if ('code' in errObj) {
        responseBody.error = {
          code: errObj.code,
          args: errObj.args,
          requestId,
        }
      }
    }

    responseBody.message = resolveMessage()

    response.status(status).json(responseBody)
  }
}
