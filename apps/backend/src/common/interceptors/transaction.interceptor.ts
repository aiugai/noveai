import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common'
import { Observable, from, lastValueFrom } from 'rxjs'
import { PrismaService } from '@/prisma/prisma.service'
import { EnvService } from '@/common/services/env.service'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { tap, map } from 'rxjs/operators'
import { TransactionEventsService } from '../services/transaction-events.service'

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  // 在 e2e 环境中静默日志输出，保持与 LoggerInterceptor 的环境变量一致（APP_ENV）
  private logger: { debug: (...args: any[]) => void; error: (...args: any[]) => void }

  // 需要跳过事务的方法列表（通常是长时间运行的流式响应）
  private readonly skipTransactionMethods = [
    'streamResponse', // SSE 流式响应
    'streamMessage', // 其他流式方法
  ]

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly env?: EnvService,
    @Optional() private readonly txEvents?: TransactionEventsService,
  ) {
    const isE2E = this.env ? this.env.isE2E() : defaultEnvAccessor.appEnv() === 'e2e'
    this.logger = isE2E
      ? { debug: () => {}, error: () => {} }
      : new Logger('TransactionInterceptor')
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()
    const className = context.getClass().name
    const methodName = handler.name
    const controllerAndMethod = `${className}.${methodName}`

    // 检查是否需要跳过事务
    if (this.skipTransactionMethods.includes(methodName)) {
      this.logger.debug(`Skipping transaction for streaming method: ${controllerAndMethod}`)
      return next.handle()
    }

    this.logger.debug(`Starting transaction for ${controllerAndMethod}`)

    // 使用 runInTransaction 启动事务（支持 REQUIRED 传播行为）
    // 重置 afterCommit 任务队列
    this.txEvents?.reset?.()

    const tx$ = from(
      this.prismaService.runInTransaction(async () => {
        this.logger.debug(`Executing ${controllerAndMethod} in transaction`)

        try {
          // 执行原始处理程序
          const result = await lastValueFrom(next.handle())
          this.logger.debug(`Transaction for ${controllerAndMethod} completed successfully`)
          return result
        } catch (error) {
          this.logger.error(`Transaction for ${controllerAndMethod} failed: ${error.message}`)
          throw error
        }
      }),
    )

    // 事务成功提交后执行 afterCommit 任务
    return tx$.pipe(
      tap(() => {
        const tasks = this.txEvents?.drainAfterCommitTasks?.() || []
        Promise.resolve()
          .then(async () => {
            const started = Date.now()
            try {
              const n = await this.txEvents?.runTasks?.(tasks)
              const cost = Date.now() - started
              this.logger.debug?.(`afterCommit executed tasks=${n ?? 0} elapsedMs=${cost}`)
            } catch (e: any) {
              this.logger.error?.(`afterCommit failed: ${e?.message || e}`)
            }
          })
          .catch(() => {})
      }),
      map(res => res),
    )
  }
}
