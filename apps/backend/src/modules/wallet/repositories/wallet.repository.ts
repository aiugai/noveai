import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { IWallet } from '../interfaces/wallet.interface'
import { TransactionStatus, Prisma, TransactionType, SystemWalletID } from '@prisma/client'
import { InsufficientBalanceException } from '../exceptions'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class WalletRepository {
  private readonly logger = new Logger(WalletRepository.name)
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { userId: string }): Promise<IWallet> {
    const tx = this.prisma.getClient()
    return tx.wallet.create({
      data: {
        userId: data.userId!,
      },
    })
  }

  async findById(id: string): Promise<IWallet | null> {
    const tx = this.prisma.getClient()
    return tx.wallet.findUnique({
      where: { id },
    })
  }

  async findByUserId(userId: string): Promise<IWallet | null> {
    const tx = this.prisma.getClient()
    return tx.wallet.findUnique({
      where: { userId },
    })
  }

  async update(id: string, data: Partial<IWallet>): Promise<IWallet> {
    const tx = this.prisma.getClient()
    return tx.wallet.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<IWallet> {
    const tx = this.prisma.getClient()
    return tx.wallet.delete({
      where: { id },
    })
  }

  /**
   * 在一个原子操作中同时减少一个钱包的余额并增加另一个钱包的余额
   * @param fromWalletId 转出钱包ID
   * @param toWalletId 转入钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 转账金额
   * @param isFromFreeze 是否从冻结余额转出
   * @param isToFreeze 是否转入到冻结余额
   * @returns 更新的行数
   */
  async transferBalance(
    fromWalletId: string,
    toWalletId: string,
    assetTypeId: string,
    amount: string,
    isFromFreeze: boolean,
    isToFreeze: boolean,
  ): Promise<number> {
    const tx = this.prisma.getClient()

    // 将 amount 转换为 Decimal 类型
    const amountDecimal = new Prisma.Decimal(amount)

    // 检查amount是否为正数
    if (amountDecimal.lte(0)) {
      throw new DomainException('Transfer amount must be greater than 0', {
        code: ErrorCode.WALLET_TRANSFER_INVALID_AMOUNT,
        args: { amount: amount.toString() },
      })
    }

    // 根据传入的参数决定更新哪些字段
    let result: number

    if (isFromFreeze && isToFreeze) {
      // 从冻结余额到冻结余额
      result = await tx.$executeRaw`
                WITH update_from AS (
                    UPDATE "wallet_assets"
                    SET "frozen_balance" = "frozen_balance" - ${amountDecimal}::numeric
                    WHERE "wallet_id" = ${fromWalletId}
                    AND "asset_type_id" = ${assetTypeId}
                    AND "frozen_balance" >= ${amountDecimal}::numeric
                    RETURNING 1
                )
                UPDATE "wallet_assets"
                SET "frozen_balance" = "frozen_balance" + ${amountDecimal}::numeric
                WHERE "wallet_id" = ${toWalletId}
                AND "asset_type_id" = ${assetTypeId}
                AND EXISTS (SELECT 1 FROM update_from);
            `
    } else if (isFromFreeze && !isToFreeze) {
      // 从冻结余额到可用余额
      result = await tx.$executeRaw`
                WITH update_from AS (
                    UPDATE "wallet_assets"
                    SET "frozen_balance" = "frozen_balance" - ${amountDecimal}::numeric
                    WHERE "wallet_id" = ${fromWalletId}
                    AND "asset_type_id" = ${assetTypeId}
                    AND "frozen_balance" >= ${amountDecimal}::numeric
                    RETURNING 1
                )
                UPDATE "wallet_assets"
                SET "balance" = "balance" + ${amountDecimal}::numeric
                WHERE "wallet_id" = ${toWalletId}
                AND "asset_type_id" = ${assetTypeId}
                AND EXISTS (SELECT 1 FROM update_from);
            `
    } else if (!isFromFreeze && isToFreeze) {
      // 从可用余额到冻结余额
      result = await tx.$executeRaw`
                WITH update_from AS (
                    UPDATE "wallet_assets"
                    SET "balance" = "balance" - ${amountDecimal}::numeric
                    WHERE "wallet_id" = ${fromWalletId}
                    AND "asset_type_id" = ${assetTypeId}
                    AND "balance" >= ${amountDecimal}::numeric
                    RETURNING 1
                )
                UPDATE "wallet_assets"
                SET "frozen_balance" = "frozen_balance" + ${amountDecimal}::numeric
                WHERE "wallet_id" = ${toWalletId}
                AND "asset_type_id" = ${assetTypeId}
                AND EXISTS (SELECT 1 FROM update_from);
            `
    } else {
      // 从可用余额到可用余额
      result = await tx.$executeRaw`
                WITH update_from AS (
                    UPDATE "wallet_assets"
                    SET "balance" = "balance" - ${amountDecimal}::numeric
                    WHERE "wallet_id" = ${fromWalletId}
                    AND "asset_type_id" = ${assetTypeId}
                    AND "balance" >= ${amountDecimal}::numeric
                    RETURNING 1
                )
                UPDATE "wallet_assets"
                SET "balance" = "balance" + ${amountDecimal}::numeric
                WHERE "wallet_id" = ${toWalletId}
                AND "asset_type_id" = ${assetTypeId}
                AND EXISTS (SELECT 1 FROM update_from);
            `
    }

    // 检查是否更新成功
    if (result === 0) {
      // 获取当前钱包资产信息用于错误消息
      const fromAsset = await tx.walletAsset.findUnique({
        where: {
          walletId_assetTypeId: {
            walletId: fromWalletId,
            assetTypeId,
          },
        },
      })

      if (!fromAsset) {
        throw new DomainException(`Wallet asset not found for wallet ${fromWalletId} and asset type ${assetTypeId}`, {
          code: ErrorCode.WALLET_ASSET_NOT_FOUND,
          args: { walletId: fromWalletId, assetTypeId },
        })
      }

      if (isFromFreeze) {
        throw new InsufficientBalanceException({
          currentBalance: String(fromAsset.frozenBalance),
          requestedAmount: amount,
          isFromFreeze: true,
        })
      } else {
        throw new InsufficientBalanceException({
          currentBalance: String(fromAsset.balance),
          requestedAmount: amount,
          isFromFreeze: false,
        })
      }
    }

    return result
  }

  async createTransaction(data: {
    fromWalletId: string | null
    toWalletId: string | null
    assetTypeId: string
    amount: string
    type: TransactionType
    reason?: string
    metadata?: Record<string, any>
    uniqueId?: string
    status?: TransactionStatus
  }): Promise<void> {
    const tx = this.prisma.getClient()
    await tx.walletTransaction.create({
      data: {
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        assetTypeId: data.assetTypeId,
        amount: data.amount,
        type: data.type,
        reason: data.reason,
        metadata: data.metadata,
        uniqueId: data.uniqueId,
        status: data.status,
      },
    })
  }

  // 获取单个钱包资产（不包含 assetType 详细信息）
  async getWalletAsset(walletId: string, assetTypeId: string) {
    const tx = this.prisma.getClient()
    return tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
    })
  }

  async createWalletAsset(data: {
    walletId: string
    assetTypeId: string
    balance: string
    frozenBalance: string
  }) {
    const tx = this.prisma.getClient()
    return tx.walletAsset.create({
      data: {
        walletId: data.walletId,
        assetTypeId: data.assetTypeId,
        balance: data.balance,
        frozenBalance: data.frozenBalance,
      },
    })
  }

  async ensureSystemWallet(walletId: SystemWalletID): Promise<void> {
    const tx = this.prisma.getClient()
    await tx.wallet.upsert({
      where: { id: walletId },
      update: {},
      create: { id: walletId },
    })
  }

  async ensureSystemWalletAsset(walletId: SystemWalletID, assetTypeId: string): Promise<void> {
    const tx = this.prisma.getClient()
    await tx.walletAsset.upsert({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
      update: {},
      create: {
        walletId,
        assetTypeId,
        balance: new Prisma.Decimal(0),
        frozenBalance: new Prisma.Decimal(0),
      },
    })
  }

  async findSystemWalletAssets(walletIds: SystemWalletID[]) {
    if (walletIds.length === 0) return []
    const tx = this.prisma.getClient()
    return tx.walletAsset.findMany({
      where: {
        walletId: {
          in: walletIds,
        },
      },
      select: {
        walletId: true,
        assetTypeId: true,
        balance: true,
        frozenBalance: true,
      },
    })
  }

  async findWalletAssetsByWalletId(walletId: string) {
    const tx = this.prisma.getClient()
    return tx.walletAsset.findMany({
      where: {
        walletId,
      },
      include: {
        assetType: true,
      },
      orderBy: {
        assetType: {
          sortOrder: 'asc',
        },
      },
    })
  }

  // 获取单个钱包资产（包含 assetType 详细信息）
  async getWalletAssetWithType(walletId: string, assetTypeId: string) {
    const tx = this.prisma.getClient()
    return tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
      include: {
        assetType: true,
      },
    })
  }

  async findTransactions(params: {
    fromWalletId?: string
    toWalletId?: string
    assetTypeId?: string
    type?: TransactionType
    page: number
    limit: number
  }) {
    const { fromWalletId, toWalletId, assetTypeId, type, page, limit } = params
    const skip = (page - 1) * limit
    const tx = this.prisma.getClient()

    const where: Prisma.WalletTransactionWhereInput = {}
    if (fromWalletId) {
      where.fromWalletId = fromWalletId
    }
    if (toWalletId) {
      where.toWalletId = toWalletId
    }
    if (assetTypeId) {
      where.assetTypeId = assetTypeId
    }
    if (type) {
      where.type = type
    }

    const [total, items] = await Promise.all([
      tx.walletTransaction.count({ where }),
      tx.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      total,
      page,
      limit,
      items,
    }
  }

  /**
   * 查询钱包的所有收支交易（既作为发送方也作为接收方）
   */
  async findWalletTransactions(
    walletId: string,
    params: {
      assetTypeId?: string
      type?: TransactionType
      page: number
      limit: number
    },
  ) {
    const { assetTypeId, type, page, limit } = params
    const skip = (page - 1) * limit
    const tx = this.prisma.getClient()

    const where: Prisma.WalletTransactionWhereInput = {
      OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
    }

    if (assetTypeId) {
      where.assetTypeId = assetTypeId
    }
    if (type) {
      where.type = type
    }

    const [total, items] = await Promise.all([
      tx.walletTransaction.count({ where }),
      tx.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      total,
      page,
      limit,
      items,
    }
  }

  async findTransactionByUniqueId(uniqueId: string) {
    const tx = this.prisma.getClient()
    if (!uniqueId) {
      return null
    }
    return tx.walletTransaction.findUnique({
      where: { uniqueId },
      include: {
        assetType: true,
        fromWallet: true,
        toWallet: true,
      },
    })
  }

  /**
   * 获取所有启用的资产类型并按优先级排序（sortOrder 越小优先级越高）
   */
  async findActiveAssetTypesSorted() {
    const tx = this.prisma.getClient()
    return tx.assetType.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 通过代码查找资产类型
   * @param code 资产类型代码
   * @returns 资产类型或null
   */
  async findAssetTypeByCode(code: string) {
    const tx = this.prisma.getClient()
    return tx.assetType.findUnique({
      where: { code },
    })
  }

  async findAssetTypeById(id: string) {
    const tx = this.prisma.getClient()
    return tx.assetType.findUnique({
      where: { id },
    })
  }

  /**
   * 测试专用冻结资产方法
   * @param walletId 钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 冻结金额
   * @returns 钱包资产信息
   */
  async testFreezeAsset(
    walletId: string,
    assetTypeId: string,
    amount: string,
    uniqueId?: string,
    reason?: string,
    metadata?: any,
  ) {
    const tx = this.prisma.getClient()

    // 查询当前余额
    const beforeAsset = await tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
    })

    if (!beforeAsset) {
      return {
        success: false,
        message: `找不到资产 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}`,
      }
    }

    const amountDec = new Prisma.Decimal(amount)
    const beforeBalDec = new Prisma.Decimal(beforeAsset.balance as any)
    if (beforeBalDec.lt(amountDec)) {
      return {
        success: false,
        message: `余额不足 - 当前: ${beforeAsset.balance}, 需要: ${amountDec.toString()}`,
      }
    }

    // 执行冻结操作
    await tx.walletAsset.update({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
      data: {
        balance: { decrement: amountDec },
        frozenBalance: { increment: amountDec },
      },
    })

    // 创建交易记录
    await tx.walletTransaction.create({
      data: {
        fromWalletId: walletId,
        toWalletId: walletId,
        assetTypeId,
        amount: amountDec.toString(),
        type: TransactionType.FREEZE,
        reason,
        metadata,
        uniqueId,
        status: 'COMPLETED',
      },
    })

    // 查询更新后的余额
    const afterAsset = await tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
    })

    return {
      success: true,
      message: `冻结成功 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}, 金额: ${amountDec.toString()}`,
      beforeAsset,
      afterAsset,
    }
  }

  /**
   * 测试专用解冻资产方法
   * @param walletId 钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 解冻金额
   * @returns 钱包资产信息
   */
  async testUnfreezeAsset(
    walletId: string,
    assetTypeId: string,
    amount: string,
    uniqueId?: string,
    reason?: string,
    metadata?: any,
  ) {
    const tx = this.prisma.getClient()

    // 查询当前余额
    const beforeAsset = await tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
    })

    if (!beforeAsset) {
      return {
        success: false,
        message: `找不到资产 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}`,
      }
    }

    const amountDec = new Prisma.Decimal(amount)
    const beforeFrozenDec = new Prisma.Decimal(beforeAsset.frozenBalance as any)
    if (beforeFrozenDec.lt(amountDec)) {
      return {
        success: false,
        message: `冻结余额不足 - 当前: ${beforeAsset.frozenBalance}, 需要: ${amountDec.toString()}`,
      }
    }

    // 执行解冻操作
    await tx.walletAsset.update({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
      data: {
        balance: { increment: amountDec },
        frozenBalance: { decrement: amountDec },
      },
    })

    // 创建交易记录
    await tx.walletTransaction.create({
      data: {
        fromWalletId: walletId,
        toWalletId: walletId,
        assetTypeId,
        amount: amountDec.toString(),
        type: TransactionType.UNFREEZE,
        reason,
        metadata,
        uniqueId,
        status: 'COMPLETED',
      },
    })

    // 查询更新后的余额
    const afterAsset = await tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId,
        },
      },
    })

    return {
      success: true,
      message: `解冻成功 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}, 金额: ${amount}`,
      beforeAsset,
      afterAsset,
    }
  }

  /**
   * 按交易类型统计交易金额
   * @param params - 统计参数
   * @param params.startDate - 开始时间
   * @param params.endDate - 结束时间
   * @param params.types - 交易类型列表
   * @param params.assetTypeIds - 可选的资产类型ID列表
   * @param params.status - 可选的交易状态
   * @returns 按资产类型代码分组的统计结果
   */
  async getTransactionStatsByType(params: {
    startDate: Date
    endDate: Date
    types: TransactionType[]
    assetTypeIds?: string[]
    status?: TransactionStatus
  }): Promise<{ assetCode: string; total: Prisma.Decimal }[]> {
    const tx = this.prisma.getClient()

    const where: Prisma.WalletTransactionWhereInput = {
      createdAt: {
        gte: params.startDate,
        lt: params.endDate,
      },
      type: { in: params.types },
      status: params.status || TransactionStatus.COMPLETED,
    }

    if (params.assetTypeIds && params.assetTypeIds.length > 0) {
      where.assetTypeId = { in: params.assetTypeIds }
    }

    const results = await tx.walletTransaction.groupBy({
      by: ['assetTypeId'],
      where,
      _sum: {
        amount: true,
      },
    })

    // 获取资产类型的 code 映射
    const assetTypeIds = results.map(r => r.assetTypeId)
    const assetTypes = await tx.assetType.findMany({
      where: { id: { in: assetTypeIds } },
      select: { id: true, code: true },
    })
    const assetCodeMap = new Map(assetTypes.map(at => [at.id, at.code]))

    return results.map(r => ({
      assetCode: assetCodeMap.get(r.assetTypeId) || r.assetTypeId,
      total: new Prisma.Decimal(r._sum.amount || 0),
    }))
  }

  /**
   * 调整系统钱包余额（支持正负数）
   * @param walletId 钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 调整金额（正数=增加，负数=减少）
   * @returns void
   * @throws NotFoundException 钱包资产不存在
   * @throws BadRequestException 余额不足
   */
  async adjustBalance(
    walletId: string,
    assetTypeId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const tx = this.prisma.getClient()

    // 查询当前余额
    const asset = await tx.walletAsset.findUnique({
      where: {
        walletId_assetTypeId: { walletId, assetTypeId },
      },
    })

    if (!asset) {
      throw new DomainException(`Wallet asset not found: walletId=${walletId}, assetTypeId=${assetTypeId}`, {
        code: ErrorCode.WALLET_ASSET_NOT_FOUND,
        args: { walletId, assetTypeId },
      })
    }

    const newBalance = new Prisma.Decimal(asset.balance).add(amount)

    // 校验余额不为负
    if (newBalance.lt(0)) {
      const currentBalance = String(asset.balance)
      const requestedAmount = amount.toString()
      throw new InsufficientBalanceException({
        currentBalance,
        requestedAmount,
        isFromFreeze: false,
      })
    }

    // 更新余额
    await tx.walletAsset.update({
      where: {
        walletId_assetTypeId: { walletId, assetTypeId },
      },
      data: {
        balance: newBalance.toString(),
      },
    })
  }

  /**
   * 查询系统钱包操作记录
   * @param query 查询参数
   * @param query.page 页码
   * @param query.limit 每页数量
   * @param query.walletIds 筛选的钱包ID列表
   * @param query.assetCodes 筛选的资产类型代码列表
   * @param query.adjustmentType 调整类型筛选
   * @param query.startDate 开始时间
   * @param query.endDate 结束时间
   * @returns 操作记录和总数
   */
  async findSystemWalletOperationLogs(query: {
    page: number
    limit: number
    walletIds?: SystemWalletID[]
    assetCodes?: string[]
    adjustmentType?: 'manual' | 'auto' | 'all'
    startDate?: string
    endDate?: string
  }): Promise<{ logs: any[]; total: number }> {
    const tx = this.prisma.getClient()

    const where: Prisma.WalletTransactionWhereInput = {
      type: TransactionType.ADMIN_ADJUST,
      OR: [
        { fromWalletId: { in: Object.values(SystemWalletID) } },
        { toWalletId: { in: Object.values(SystemWalletID) } },
      ],
    }

    // 应用筛选条件
    if (query.walletIds && query.walletIds.length > 0) {
      where.OR = [
        { fromWalletId: { in: query.walletIds } },
        { toWalletId: { in: query.walletIds } },
      ]
    }

    if (query.assetCodes && query.assetCodes.length > 0) {
      const assetTypes = await tx.assetType.findMany({
        where: { code: { in: query.assetCodes } },
        select: { id: true },
      })
      const assetTypeIds = assetTypes.map(at => at.id)
      if (assetTypeIds.length > 0) {
        where.assetTypeId = { in: assetTypeIds }
      } else {
        // 如果没有找到匹配的资产类型，返回空结果
        return { logs: [], total: 0 }
      }
    }

    if (query.adjustmentType && query.adjustmentType !== 'all') {
      where.metadata = {
        path: ['adjustmentType'],
        equals: query.adjustmentType,
      }
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate)
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate)
      }
    }

    const skip = (query.page - 1) * query.limit

    const [logs, total] = await Promise.all([
      tx.walletTransaction.findMany({
        where,
        include: {
          assetType: true,
        },
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      tx.walletTransaction.count({ where }),
    ])

    return { logs, total }
  }

  /**
   * 批量查找资产类型ID（根据代码）
   * @param codes 资产类型代码数组
   * @returns 资产类型ID数组
   */
  async findAssetTypeIdsByCodes(codes: string[]): Promise<string[]> {
    if (!codes || codes.length === 0) return []

    const tx = this.prisma.getClient()
    const assetTypes = await tx.assetType.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    })

    return assetTypes.map(at => at.id)
  }
}
