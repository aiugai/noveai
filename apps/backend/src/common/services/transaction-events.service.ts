import { Injectable, Logger } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

type Task = () => void | Promise<void>

@Injectable()
export class TransactionEventsService {
  private readonly logger = new Logger(TransactionEventsService.name)
  constructor(private readonly cls: ClsService) {}

  afterCommit(task: Task): void {
    // 若当前不存在事务上下文（未通过 TransactionInterceptor/PrismaService.runInTransaction），
    // 则立即（微任务）执行，保障非 HTTP/测试场景的可用性
    const inTx = Boolean(this.cls.get('PRISMA_TRANSACTION'))
    if (!inTx) {
      Promise.resolve()
        .then(() => task())
        .catch(error => {
          const meta = { err: error?.message, stack: error?.stack }
          this.logger.warn(`afterCommit fallback task failed: ${meta.err}\n${meta.stack ?? ''}`)
        })
      return
    }
    const list = (this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []
    list.push(task)
    this.cls.set(AFTER_COMMIT_TASKS_KEY, list)
  }

  /**
   * 从 CLS 中取出并清空 afterCommit 任务
   */
  drainAfterCommitTasks(): Task[] {
    const list = ((this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []).slice()
    this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
    return list
  }

  /**
   * 执行给定任务列表
   */
  async runTasks(tasks: Task[]): Promise<number> {
    let ok = 0
    for (const t of tasks) {
      try {
        await t()
        ok++
      } catch {
        // 单个任务失败忽略，避免影响后续任务
      }
    }
    return ok
  }

  /**
   * 在进入事务前重置任务队列
   */
  reset(): void {
    this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
  }
}
