import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { EnvService } from '../services/env.service'
import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { DomainException } from '../exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { Prisma } from '@prisma/client'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'

// Prisma 7 兼容：从 Prisma 命名空间获取错误类型（值和类型）
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError

const isAuthenticatedUser = (user: unknown): user is AuthenticatedUser => {
  if (!user || typeof user !== 'object') {
    return false
  }
  return typeof (user as AuthenticatedUser).id === 'string'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readMetaScalar = (meta: unknown, key: string): string => {
  if (!isRecord(meta) || !(key in meta)) {
    return 'unknown'
  }
  const value = meta[key]
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return 'unknown'
}

const readMetaArray = (meta: unknown, key: string): unknown[] => {
  if (!isRecord(meta) || !(key in meta)) {
    return []
  }
  const value = meta[key]
  return Array.isArray(value) ? value : []
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly env: EnvService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    // 🔹 Prisma 异常特殊处理（P2034 事务超时告警）
    if (exception instanceof PrismaClientKnownRequestError) {
      this.handlePrismaException(exception, req, res)
      return
    }

    // 解析基础信息
    const isHttp = exception instanceof HttpException
    const status = isHttp
      ? (exception as HttpException).getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    // 从请求中取 requestId（由拦截器注入），若没有则兜底生成
    const requestId =
      (res.getHeader('X-Request-Id') as string) ||
      (req.headers['x-request-id'] as string | undefined) ||
      randomUUID()

    // 尝试抽取自定义异常信息
    let code: string | undefined
    let args: Record<string, any> | undefined
    let message = 'Error'

    let rawResponse: any | undefined

    if (exception instanceof DomainException) {
      code = exception.code
      args = exception.args
      message = exception.message
    } else if (isHttp) {
      const httpEx = exception as HttpException
      const response: any = httpEx.getResponse()
      rawResponse = response
      // 常见 HttpException 的 message 可能是 string | string[] | object
      const rawMessage = (response && (response.message ?? response.error)) || httpEx.message
      message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : String(rawMessage ?? 'Http Error')

      // 如果返回体包含 args/code，按后端自定义优先
      if (response && typeof response === 'object') {
        code = response.code ?? code
        args = response.args ?? args
      }
    } else if (exception && typeof exception === 'object') {
      message = (exception as any).message ?? 'Internal Error'
    }

    // 基础结构（对外部系统稳定）
    const nodeEnv = this.env.getNodeEnv()
    const appEnv = this.env.getAppEnv()
    const body: any = {
      status,
      error: {
        code: code ?? this.mapStatusToCode(status),
        args: args ?? undefined,
        requestId: requestId || undefined,
      },
      // 开发环境返回 message，生产环境不返回（测试环境优先原始 message）
      ...(nodeEnv !== 'production' &&
        (rawResponse && typeof rawResponse === 'object' && 'message' in rawResponse
          ? { message: (rawResponse as any).message }
          : { message })),
      timestamp: new Date().toISOString(),
      path: req.originalUrl || req.url,
    }

    // 测试/开发环境兼容 E2E 断言：尽可能保留原始异常体字段（message/ error 等）
    if (appEnv === 'test' || nodeEnv !== 'production') {
      if (rawResponse && typeof rawResponse === 'object') {
        // 如果原始 message 是数组或对象（如 ValidationPipe），直接覆盖为原始结构
        if (rawResponse.message && typeof rawResponse.message !== 'string') {
          body.message = rawResponse.message
        }
        // 浮出原始 error 字段，便于用例断言 response.body.error
        if (rawResponse.error && typeof rawResponse.error === 'string') {
          body.error = rawResponse.error
        }
      }

      // Debug 信息：避免与顶层 status 字段重复，将 statusCode 放在 debug 对象中
      if (rawResponse && typeof rawResponse === 'object' && rawResponse.statusCode) {
        body.debug = {
          ...body.debug,
          statusCode: rawResponse.statusCode,
        }
      }
    }

    // 设置请求标识头
    if (requestId) {
      res.setHeader('X-Request-Id', requestId)
    }

    res.status(status).json(body)
  }

  /**
   * 处理 Prisma 异常
   */
  private handlePrismaException(
    exception: PrismaClientKnownRequestError,
    req: Request,
    res: Response,
  ): void {
    const requestId =
      (res.getHeader('X-Request-Id') as string) ||
      (req.headers['x-request-id'] as string | undefined) ||
      randomUUID()

    const requestUser = isAuthenticatedUser(req.user) ? req.user : null
    const userId = requestUser?.id ?? 'anonymous'
    const path = req.originalUrl || req.url
    const method = req.method

    // P2034: 交互式事务超时（重点告警）
    if (exception.code === 'P2034') {
      this.logger.error(`🚨 事务超时告警 - ${method} ${path}`, {
        code: exception.code,
        timeout: readMetaScalar(exception.meta, 'timeout'),
        elapsed: readMetaScalar(exception.meta, 'elapsed'),
        userId,
        path,
        method,
        requestId,
        timestamp: new Date().toISOString(),
      })

      res.setHeader('X-Request-Id', requestId)
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          args: { detail: 'TransactionTimeout' },
          requestId,
        },
        timestamp: new Date().toISOString(),
        path,
      })
      return
    }

    // P2002: 唯一约束冲突
    if (exception.code === 'P2002') {
      this.logger.warn(`唯一约束冲突 - ${method} ${path}`, {
        code: exception.code,
        target: (exception.meta as any)?.target || [],
        userId,
        requestId,
      })

      res.setHeader('X-Request-Id', requestId)
      res.status(HttpStatus.CONFLICT).json({
        status: HttpStatus.CONFLICT,
        error: {
          code: ErrorCode.CONFLICT,
          args: {
            detail: 'UniqueConstraintViolation',
            target: readMetaArray(exception.meta, 'target'),
          },
          requestId,
        },
        timestamp: new Date().toISOString(),
        path,
      })
      return
    }

    // P2025: 记录不存在
    if (exception.code === 'P2025') {
      this.logger.warn(`记录不存在 - ${method} ${path}`, {
        code: exception.code,
        userId,
        requestId,
      })

      res.setHeader('X-Request-Id', requestId)
      res.status(HttpStatus.NOT_FOUND).json({
        status: HttpStatus.NOT_FOUND,
        error: {
          code: ErrorCode.NOT_FOUND,
          args: { detail: 'RecordNotFound' },
          requestId,
        },
        timestamp: new Date().toISOString(),
        path,
      })
      return
    }

    // 其他 Prisma 错误
    this.logger.error(`Prisma 错误 [${exception.code}] - ${method} ${path}`, {
      code: exception.code,
      message: exception.message,
      meta: exception.meta,
      userId,
      requestId,
      stack: exception.stack,
    })

    res.setHeader('X-Request-Id', requestId)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        args: { detail: 'DatabaseError' },
        requestId,
      },
      timestamp: new Date().toISOString(),
      path,
    })
  }

  private mapStatusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.UNPROCESSABLE_ENTITY
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR
    }
  }
}
