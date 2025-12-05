import { HttpException, HttpStatus } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'

export interface DomainExceptionPayload {
  /** 业务错误码(必填,使用 ErrorCode 枚举) */
  code: ErrorCode
  /** 动态参数(用于错误消息插值,前端可用于国际化) */
  args?: Record<string, any>
  /** HTTP 状态码(默认 400) */
  status?: number
}

/**
 * 领域异常基类：用于在服务层抛出具有统一结构的业务错误
 *
 * @remarks
 * - 后端仅返回 code 和 args，不处理多语言文案
 * - 前端基于 code 映射本地化消息，由前端完全掌控 i18n
 *
 * @example
 * throw new DomainException('Insufficient balance', {
 *   code: ErrorCode.WALLET_INSUFFICIENT_BALANCE,
 *   args: { required: '10.00', current: '5.00' }
 * })
 */
export class DomainException extends HttpException {
  public readonly code: ErrorCode
  public readonly args?: Record<string, any>

  constructor(message: string, payload: DomainExceptionPayload) {
    const status = payload.status ?? HttpStatus.BAD_REQUEST
    super(
      {
        message,
        code: payload.code,
        args: payload.args,
      },
      status,
    )

    this.code = payload.code
    this.args = payload.args
  }
}
