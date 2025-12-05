import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Injectable, Logger } from '@nestjs/common'
import { MessageEnvelope, MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import {
  TOPIC_PAYMENT_WITHDRAW_EVENTS,
  TOPIC_WALLET_EVENTS,
} from '@/modules/message-bus/message-bus.topics'
import { PAYMENT_EVENT, WALLET_EVENT } from '@/modules/message-bus/message-bus.event-types'
import { WithdrawRequestedDto } from '@/modules/message-bus/dto/payment-withdraw-requested.event.dto'
import { WithdrawCallbackReceivedDto } from '@/modules/message-bus/dto/payment-withdraw-callback.event.dto'
import { MessageBusService } from '@/modules/message-bus/message-bus.service'
import { WalletService } from '../wallet.service'
import { PrismaService } from '@/prisma/prisma.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { ClsService } from 'nestjs-cls'

@Injectable()
@Processor(MESSAGE_BUS_QUEUE)
export class WalletPaymentWithdrawSubscriber {
  private readonly logger = new Logger(WalletPaymentWithdrawSubscriber.name)

  constructor(
    private readonly walletService: WalletService,
    private readonly bus: MessageBusService,
    private readonly prisma: PrismaService,
    private readonly txEvents: TransactionEventsService,
    private readonly cls: ClsService,
  ) {
    // 明确打印订阅者初始化，便于E2E调试
    this.logger.debug('[Init] WalletPaymentWithdrawSubscriber initialized')
  }

  @Process(TOPIC_PAYMENT_WITHDRAW_EVENTS)
  async handle(job: Job<MessageEnvelope<any>>): Promise<void> {
    const payload = job.data
    const { type, data, meta } = payload
    const correlationId = meta?.correlationId
    try {
      this.logger.log(
        `WalletPaymentWithdrawSubscriber received type='${type}', jobId='${job.id}', correlationId='${correlationId ?? ''}'`,
      )
      switch (type) {
        case PAYMENT_EVENT.WITHDRAW_REQUESTED: {
          const dto = data as WithdrawRequestedDto
          this.logger.log(
            `Processing WITHDRAW_REQUESTED requestId=${dto.requestId}, walletId=${dto.walletId}, assetTypeId=${dto.assetTypeId}, amount=${dto.amount}`,
          )
          await this.cls.run(async () => {
            this.txEvents.reset()
            await this.prisma.runInTransaction(async () => {
              // 幂等：若已存在同 uniqueId 的冻结/交易记录，则直接返回成功（提交后回执）
              if (dto.uniqueId) {
                const existed = await this.walletService.getTransactionByUniqueId(dto.uniqueId)
                if (existed) {
                  if (correlationId) {
                    this.txEvents.afterCommit(async () => {
                      await this.bus.markDone(correlationId, {
                        requestId: dto.requestId,
                        ok: true,
                        holdId: dto.uniqueId,
                      })
                    })
                  }
                  return
                }
              }

              // 执行冻结
              await this.walletService.frozenAsset(
                dto.walletId!,
                dto.assetTypeId!,
                dto.amount,
                dto.reason,
                dto.metadata,
                dto.uniqueId,
              )

              if (correlationId) {
                this.txEvents.afterCommit(async () => {
                  await this.bus.markDone(correlationId, {
                    requestId: dto.requestId,
                    ok: true,
                    holdId: dto.uniqueId,
                  })
                })
              }
            })
            const tasks = this.txEvents.drainAfterCommitTasks()
            await this.txEvents.runTasks(tasks)
          })
          break
        }
        case PAYMENT_EVENT.WITHDRAW_APPROVED: {
          const dto = data as WithdrawRequestedDto
          // 将冻结金额正式扣减至系统提现钱包
          await this.cls.run(async () => {
            this.txEvents.reset()
            await this.prisma.runInTransaction(async () => {
              const txId = await this.walletService.finalizeWithdrawFromHold(
                dto.walletId!,
                dto.assetTypeId!,
                dto.amount,
                dto.reason,
                dto.metadata,
                dto.uniqueId,
              )
              // 广播完成事件（提交后）
              this.txEvents.afterCommit(async () => {
                await this.bus.publish(
                  TOPIC_WALLET_EVENTS,
                  WALLET_EVENT.TRANSACTION_COMPLETED,
                  { requestId: dto.requestId, ok: true, transactionId: txId },
                  { dedupeKey: dto.uniqueId },
                )
              })
            })
            const tasks = this.txEvents.drainAfterCommitTasks()
            await this.txEvents.runTasks(tasks)
          })
          break
        }
        case PAYMENT_EVENT.WITHDRAW_REJECTED: {
          const dto = data as WithdrawRequestedDto
          // 释放冻结
          await this.cls.run(async () => {
            this.txEvents.reset()
            await this.prisma.runInTransaction(async () => {
              await this.walletService.unfrozenAsset(
                dto.walletId!,
                dto.assetTypeId!,
                dto.amount,
                dto.reason,
                dto.metadata,
                dto.uniqueId,
              )
              this.txEvents.afterCommit(async () => {
                await this.bus.publish(
                  TOPIC_WALLET_EVENTS,
                  WALLET_EVENT.HOLD_RELEASED,
                  { requestId: dto.requestId, ok: true },
                  { dedupeKey: `${dto.uniqueId}:released` },
                )
              })
            })
            const tasks = this.txEvents.drainAfterCommitTasks()
            await this.txEvents.runTasks(tasks)
          })
          break
        }
        case PAYMENT_EVENT.WITHDRAW_CALLBACK_RECEIVED: {
          const dto = data as WithdrawCallbackReceivedDto
          const ok = dto.ok ?? dto.providerStatus?.toUpperCase() === 'COMPLETED'

          if (ok) {
            // 确认完成（幂等），通知支付侧完成（提交后）
            await this.cls.run(async () => {
              this.txEvents.reset()
              await this.prisma.runInTransaction(async () => {
                this.txEvents.afterCommit(async () => {
                  await this.bus.publish(
                    TOPIC_WALLET_EVENTS,
                    WALLET_EVENT.TRANSACTION_COMPLETED,
                    { requestId: dto.requestId, ok: true },
                    { dedupeKey: `${dto.requestId}:cb:completed` },
                  )
                })
                const tasks = this.txEvents.drainAfterCommitTasks()
                await this.txEvents.runTasks(tasks)
              })
            })
          } else {
            // 失败补偿：优先尝试释放冻结，否则回退系统提现到用户
            try {
              if (dto.walletId && dto.assetTypeId && dto.amount) {
                await this.cls.run(async () => {
                  await this.prisma.runInTransaction(async () => {
                    await this.walletService.unfrozenAsset(
                      dto.walletId,
                      dto.assetTypeId,
                      Number(dto.amount),
                      'Withdraw failed - unfreeze by callback',
                      { externalWithdrawId: dto.externalWithdrawId, raw: dto.raw },
                      `${dto.uniqueId}:unfreeze`,
                    )
                    this.txEvents.afterCommit(async () => {
                      await this.bus.publish(
                        TOPIC_WALLET_EVENTS,
                        WALLET_EVENT.HOLD_RELEASED,
                        { requestId: dto.requestId, ok: false, reason: 'callback_failed' },
                        { dedupeKey: `${dto.requestId}:cb:released` },
                      )
                    })
                  })
                })
              }
            } catch (e) {
              // 若解冻失败（可能已完成扣款），执行退款
              if (dto.walletId && dto.assetTypeId && dto.amount) {
                try {
                  await this.cls.run(async () => {
                    this.txEvents.reset()
                    await this.prisma.runInTransaction(async () => {
                      await this.walletService.refundFromSystemWithdraw(
                        dto.walletId,
                        dto.assetTypeId,
                        Number(dto.amount),
                        'Withdraw failed - refund by callback',
                        { externalWithdrawId: dto.externalWithdrawId, raw: dto.raw },
                        `${dto.uniqueId}:refund`,
                      )
                      this.txEvents.afterCommit(async () => {
                        await this.bus.publish(
                          TOPIC_WALLET_EVENTS,
                          WALLET_EVENT.TRANSACTION_REVERTED,
                          { requestId: dto.requestId, ok: true, reason: (e as Error).message },
                          { dedupeKey: `${dto.requestId}:cb:reverted` },
                        )
                      })
                      const tasks = this.txEvents.drainAfterCommitTasks()
                      await this.txEvents.runTasks(tasks)
                    })
                  })
                } catch (e2) {
                  await this.cls.run(async () => {
                    this.txEvents.reset()
                    await this.prisma.runInTransaction(async () => {
                      this.txEvents.afterCommit(async () => {
                        await this.bus.publish(
                          TOPIC_WALLET_EVENTS,
                          WALLET_EVENT.TRANSACTION_REVERTED,
                          {
                            requestId: dto.requestId,
                            ok: false,
                            reason: (e2 as Error).message || (e as Error).message,
                          },
                          { dedupeKey: `${dto.requestId}:cb:reverted:fail` },
                        )
                      })
                      const tasks = this.txEvents.drainAfterCommitTasks()
                      await this.txEvents.runTasks(tasks)
                    })
                  })
                }
              }
            }
          }
          break
        }
        default:
          // ignore other payment events
          break
      }
    } catch (err) {
      this.logger.error(
        `Failed topic='${payload.topic}', type='${payload.type}', jobId='${job.id}': ${String(
          err,
        )}`,
      )
      if (correlationId) {
        await this.bus.markDone(correlationId, {
          requestId: (payload.data as any)?.requestId,
          ok: false,
          reason: (err as Error).message,
        })
      }
      throw err
    }
  }
}
