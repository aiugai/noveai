import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Injectable, Logger } from '@nestjs/common'
import { AssetCode } from '@ai/shared'
import { EnvService } from '@/common/services/env.service'
import { PrismaService } from '@/prisma/prisma.service'
import { WalletService } from '../wallet.service'
import { MessageEnvelope, MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { TOPIC_AI_MODEL_EVENTS } from '@/modules/message-bus/message-bus.topics'
import { AI_USAGE_EVENT } from '@/modules/message-bus/message-bus.event-types'
import { AIUsageMeasuredV1Dto } from '@/modules/message-bus/dto/ai-usage-measured.event.dto'
import Decimal from 'decimal.js'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { ClsService } from 'nestjs-cls'
import { InsufficientBalanceException } from '../exceptions'

// 常量定义
const ASSET_TYPE_SCORE = AssetCode.SCORE as const

@Injectable()
@Processor(MESSAGE_BUS_QUEUE)
export class AiUsageBillingSubscriber {
  private readonly logger = new Logger(AiUsageBillingSubscriber.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly env: EnvService,
    private readonly txEvents: TransactionEventsService,
    private readonly cls: ClsService,
  ) {}

  @Process(TOPIC_AI_MODEL_EVENTS)
  async handle(job: Job<MessageEnvelope<unknown>>): Promise<void> {
    const payload = job.data
    this.logger.log(
      `Received job: id=${job.id}, topic=${payload.topic}, type=${payload.type}, correlationId=${payload.meta?.correlationId ?? ''}`,
    )
    if (payload.type !== AI_USAGE_EVENT.USAGE_MEASURED_V1) return

    // 将原始数据转换并进行 class-validator 校验
    const data = plainToInstance(AIUsageMeasuredV1Dto, payload.data)
    const errors = validateSync(data, { whitelist: true, forbidUnknownValues: true })
    if (errors.length > 0) {
      this.logger.warn('AIUsageMeasuredV1Dto 校验失败，事件已丢弃', {
        correlationId: payload.meta?.correlationId,
        errors: errors.map(e => e.toString()).slice(0, 3),
      })
      return
    }
    const {
      usageId,
      userId,
      inputTokens,
      outputTokens,
      source,
    } = data

    try {
      await this.cls.run(async () => {
        // 非 HTTP 场景：显式管理 afterCommit 任务队列
        this.txEvents.reset()
        await this.prisma.runInTransaction(async () => {
          // 幂等旁路：如 usageId 已处理则直接返回
          if (usageId) {
            const existed = await this.walletService.getTransactionByUniqueId(usageId)
            if (existed) {
              this.logger.debug('重复 usageId 已处理，跳过计费（幂等）', { usageId })
              return
            }
          }

          // 简化版定价：直接使用配置的每千 token 价格
          // 实际项目中应该从 VirtualModel 表读取定价
          const inputPricePerK = new Decimal('0.001') // 默认价格
          const outputPricePerK = new Decimal('0.002') // 默认价格

          // 费用计算：使用 Decimal，统一 6 位精度，避免浮点误差
          const inputCost = inputPricePerK.mul(inputTokens).div(1000)
          const outputCost = outputPricePerK.mul(outputTokens).div(1000)
          const totalCost = inputCost.plus(outputCost).toDecimalPlaces(6)

          if (totalCost.lte(0)) {
            this.logger.warn('计算得到的费用为 0，跳过计费', { usageId, userId })
            return
          }

          // 风控与阈值监控
          const TOKENS_ALERT_THRESHOLD = this.env.tokensAlertThreshold()
          const COST_ALERT_THRESHOLD = new Decimal(String(this.env.costAlertThreshold()))
          const totalTokensUsed = (inputTokens || 0) + (outputTokens || 0)
          if (totalTokensUsed > TOKENS_ALERT_THRESHOLD || totalCost.gt(COST_ALERT_THRESHOLD)) {
            this.logger.warn('用量/费用异常阈值告警', {
              usageId,
              userId,
              totalTokensUsed,
              totalCost: totalCost.toFixed(6),
              thresholds: {
                TOKENS_ALERT_THRESHOLD,
                COST_ALERT_THRESHOLD: COST_ALERT_THRESHOLD.toFixed(6),
              },
            })
          }

          // 记录用户钱包与余额情况
          const tx = this.prisma.getClient()
          const wallet = await tx.wallet.findUnique({ where: { userId } })
          const scoreAssetType = await tx.assetType.findUnique({
            where: { code: ASSET_TYPE_SCORE },
          })
          let beforeBalance: string | undefined
          if (wallet && scoreAssetType) {
            const wa = await tx.walletAsset.findUnique({
              where: {
                walletId_assetTypeId: { walletId: wallet.id, assetTypeId: scoreAssetType.id },
              },
            })
            beforeBalance = wa ? String(wa.balance) : undefined
          }
          this.logger.debug('Wallet balance snapshot (before)', {
            usageId,
            userId,
            walletId: wallet?.id,
            assetTypeId: scoreAssetType?.id,
            balance: beforeBalance ?? '(none)',
          })

          // 元数据
          const metadata = {
            billingType: 'ai_chat_score',
            tokenUsage: {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
            costBreakdown: {
              inputCost: inputCost.toFixed(6),
              outputCost: outputCost.toFixed(6),
              totalCost: totalCost.toFixed(6),
            },
            context: {
              source,
            },
            calculatedAt: new Date().toISOString(),
            billingVersion: '3.0',
          }

          // 尝试扣费，如果余额不足则扣除所有剩余余额
          let chargedAmount: Decimal = totalCost
          let balanceCleared = false

          try {
            await this.walletService.consume(
              userId,
              ASSET_TYPE_SCORE,
              totalCost.toFixed(6),
              `AI chat billing - ${source || 'chat'}`,
              metadata,
              usageId,
            )

            this.logger.log('AI usage billed by wallet successfully', {
              usageId,
              userId,
              totalCost: totalCost.toFixed(6),
            })
          } catch (consumeError) {
            if (consumeError instanceof InsufficientBalanceException) {
              this.logger.warn('Insufficient balance detected, clearing remaining balance', {
                usageId,
                userId,
                requestedAmount: totalCost.toFixed(6),
                currentBalance: consumeError.currentBalance,
              })

              if (!wallet || !scoreAssetType) {
                this.logger.error('Cannot clear balance: wallet or scoreAssetType not found', {
                  usageId,
                  userId,
                  hasWallet: !!wallet,
                  hasScoreAssetType: !!scoreAssetType,
                })
                throw consumeError
              }

              // 查询当前剩余余额
              const currentBalance = await tx.walletAsset.findUnique({
                where: {
                  walletId_assetTypeId: { walletId: wallet.id, assetTypeId: scoreAssetType.id },
                },
                select: { balance: true },
              })

              if (currentBalance && new Decimal(currentBalance.balance).gt(0)) {
                const balanceToDeduct = new Decimal(currentBalance.balance).toDecimalPlaces(
                  6,
                  Decimal.ROUND_DOWN,
                )

                try {
                  await this.walletService.consume(
                    userId,
                    ASSET_TYPE_SCORE,
                    balanceToDeduct.toString(),
                    `AI chat billing (balance cleared) - ${source || 'chat'}`,
                    {
                      ...metadata,
                      originalCost: totalCost.toFixed(6),
                      clearedBalance: balanceToDeduct.toString(),
                      balanceCleared: true,
                    },
                    `${usageId}-clear`,
                  )

                  chargedAmount = balanceToDeduct
                  balanceCleared = true

                  this.logger.warn('Remaining balance cleared due to insufficient funds', {
                    usageId,
                    userId,
                    originalCost: totalCost.toFixed(6),
                    clearedAmount: balanceToDeduct.toString(),
                  })
                } catch (clearError) {
                  if (clearError instanceof InsufficientBalanceException) {
                    chargedAmount = new Decimal(0)
                    balanceCleared = true
                    this.logger.warn('Balance already cleared by concurrent transaction', {
                      usageId,
                      userId,
                    })
                  } else {
                    throw clearError
                  }
                }
              } else {
                chargedAmount = new Decimal(0)
                this.logger.warn('No remaining balance to clear', {
                  usageId,
                  userId,
                  originalCost: totalCost.toFixed(6),
                })
              }
            } else {
              throw consumeError
            }
          }

          // 记录扣费后的余额
          if (wallet && scoreAssetType) {
            const after = await tx.walletAsset.findUnique({
              where: {
                walletId_assetTypeId: { walletId: wallet.id, assetTypeId: scoreAssetType.id },
              },
            })
            this.logger.debug('Wallet balance snapshot (after)', {
              usageId,
              userId,
              walletId: wallet.id,
              assetTypeId: scoreAssetType.id,
              balance: after ? String(after.balance) : '(none)',
              chargedAmount: chargedAmount.toFixed(6),
              balanceCleared,
            })
          }
        })
        // 事务成功后，主动执行 afterCommit 任务
        const tasks = this.txEvents.drainAfterCommitTasks()
        await this.txEvents.runTasks(tasks)
      })
    } catch (err) {
      const logPayload: any = {
        usageId,
        userId,
        error: (err as Error)?.message,
      }
      if (!this.env.isProd()) {
        logPayload.stack = (err as Error)?.stack
      }
      this.logger.error('AI usage billing failed', logPayload)
      throw err
    }
  }
}
