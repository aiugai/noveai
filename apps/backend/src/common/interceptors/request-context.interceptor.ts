import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { I18nContext } from 'nestjs-i18n'

/**
 * 为每次请求生成/透传 requestId，并设置 Content-Language 头。
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()

    // 透传或生成 X-Request-Id（仅在响应头尚未发送时设置，避免 SSE 已开始写入后的重复设置）
    const incomingId = (req.headers['x-request-id'] as string) || ''
    const requestId = incomingId || uuidv4()
    if (!res.headersSent) {
      res.setHeader('X-Request-Id', requestId)
    }

    // 设置语言头（基于 i18n 解析的语言；同样仅在未发送头时设置）
    const i18n = I18nContext.current()
    if (i18n?.lang && !res.headersSent) {
      res.setHeader('Content-Language', i18n.lang)
    }

    return next.handle().pipe(
      tap(() => {
        // 响应阶段保持以上头部
      }),
    )
  }
}
