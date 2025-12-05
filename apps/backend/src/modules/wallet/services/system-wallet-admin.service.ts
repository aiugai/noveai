import { Injectable, Logger } from '@nestjs/common'
import { WalletRepository } from '../repositories/wallet.repository'
import { AuditLogService, AuditLogType } from '@/modules/admin/audit/audit-log.service'
import { SystemWalletID, TransactionType, TransactionStatus } from '@prisma/client'
import Decimal from 'decimal.js'
import { AssetTypeNotFoundException } from '../exceptions'
import {
  SYSTEM_WALLET_GROUPS,
  SYSTEM_WALLET_NAMES,
  SYSTEM_WALLET_MIGRATION_TARGETS,
  SYSTEM_WALLET_METADATA,
  SystemWalletMetadata,
} from '../constants/system-wallet-groups'
import {
  SystemWalletOverviewDto,
  SystemWalletItemDto,
} from '../dto/responses/system-wallet-overview.dto'
import {
  SystemWalletOperationLogDto,
  PaginatedSystemWalletOperationLogDto,
} from '../dto/responses/system-wallet-operation-log.dto'
import { SystemWalletOperationQueryDto } from '../dto/requests/system-wallet-operation-query.dto'
import {
  WalletMetadataResponseDto,
  SystemWalletMetadataDto,
  AssetTypeMetadataDto,
} from '../dto/responses/wallet-metadata.dto'

/**
 * 系统钱包资产类型（从仓储层返回）
 */
interface SystemWalletAsset {
  walletId: string
  assetTypeId: string
  balance: Decimal
  frozenBalance: Decimal
  updatedAt?: Date
}

/**
 * 系统钱包调整交易的 metadata 类型
 */
interface SystemWalletAdjustmentMetadata {
  operatorId?: string
  direction?: 'INCREASE' | 'DECREASE'
  adjustmentType?: 'manual' | 'auto'
  balanceBefore?: string
  balanceAfter?: string
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class SystemWalletAdminService {
  private readonly logger = new Logger(SystemWalletAdminService.name)

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 获取系统钱包概览（按分组）
   */
  async getSystemWalletsOverview(): Promise<SystemWalletOverviewDto> {
    // 获取所有系统钱包 ID
    const allWalletIds = Object.values(SystemWalletID)

    // 查询所有系统钱包的资产
    const assets = await this.walletRepository.findSystemWalletAssets(allWalletIds)

    // 获取资产类型映射
    const assetTypes = await this.walletRepository.findActiveAssetTypesSorted()
    const assetTypeMap = new Map(assetTypes.map(at => [at.id, { code: at.code, name: at.name }]))

    // 构建资产数据映射: walletId -> assetTypeId -> asset
    const assetMap = new Map<SystemWalletID, Map<string, SystemWalletAsset>>()
    for (const asset of assets) {
      if (!assetMap.has(asset.walletId as SystemWalletID)) {
        assetMap.set(asset.walletId as SystemWalletID, new Map())
      }
      assetMap.get(asset.walletId as SystemWalletID)!.set(asset.assetTypeId, asset)
    }

    // 初始化返回结构
    const result: SystemWalletOverviewDto = {
      revenue: { groupName: '收入类钱包', wallets: [] },
      expense: { groupName: '支出类钱包', wallets: [] },
      transit: { groupName: '中转类钱包', wallets: [] },
      special: { groupName: '特殊类钱包', wallets: [] },
      legacy: [],
    }

    // 遍历分组配置，填充数据
    for (const group of SYSTEM_WALLET_GROUPS) {
      for (const walletId of group.walletIds) {
        // 获取钱包元数据
        const metadata = SYSTEM_WALLET_METADATA[walletId]
        if (!metadata) {
          this.logger.warn(`Wallet metadata not found: ${walletId}`)
          continue
        }

        // 获取该钱包的所有资产数据
        const walletAssets = assetMap.get(walletId)

        // 为每个资产类型创建一个记录
        // 如果钱包没有资产,至少为主要资产类型(SCORE和DIAMOND)创建默认记录
        const assetTypesToProcess =
          walletAssets && walletAssets.size > 0
            ? Array.from(walletAssets.keys())
            : assetTypes.slice(0, 2).map(at => at.id) // 默认显示前两个资产类型(SCORE, DIAMOND)

        for (const assetTypeId of assetTypesToProcess) {
          const asset = walletAssets?.get(assetTypeId)
          const assetTypeInfo = assetTypeMap.get(assetTypeId)

          if (!assetTypeInfo) {
            this.logger.warn(`Asset type not found: ${assetTypeId}`)
            continue
          }

          // 构建钱包项
          const item: SystemWalletItemDto = asset
            ? this.buildWalletItemFromAsset(
                walletId,
                metadata,
                asset,
                assetTypeInfo,
                group.key === 'legacy',
              )
            : this.buildEmptyWalletItem(walletId, metadata, assetTypeInfo, group.key === 'legacy')

          // 添加到对应分组
          if (group.key === 'legacy') {
            result.legacy.push(item)
          } else {
            result[group.key].wallets.push(item)
          }
        }
      }
    }

    return result
  }

  /**
   * 从资产数据构建钱包项
   * @private
   */
  private buildWalletItemFromAsset(
    walletId: SystemWalletID,
    metadata: SystemWalletMetadata,
    asset: SystemWalletAsset,
    assetTypeInfo: { code: string; name: string },
    isLegacy: boolean,
  ): SystemWalletItemDto {
    const balance = new Decimal(asset.balance.toString())
    const frozenBalance = new Decimal(asset.frozenBalance.toString())
    const totalBalance = balance.add(frozenBalance)

    return {
      walletId,
      walletName: metadata.name,
      displayName: `${metadata.name}(${metadata.code})`,
      walletCode: metadata.code,
      isAdjustable: metadata.isAdjustable,
      assetCode: assetTypeInfo.code,
      assetName: assetTypeInfo.name,
      balance: balance.toString(),
      frozenBalance: frozenBalance.toString(),
      totalBalance: totalBalance.toString(),
      updatedAt: asset.updatedAt || new Date(),
      isLegacy,
      migrationTarget: isLegacy ? SYSTEM_WALLET_MIGRATION_TARGETS[walletId] : undefined,
    }
  }

  /**
   * 构建空钱包项(余额为0)
   * @private
   */
  private buildEmptyWalletItem(
    walletId: SystemWalletID,
    metadata: SystemWalletMetadata,
    assetTypeInfo: { code: string; name: string },
    isLegacy: boolean,
  ): SystemWalletItemDto {
    return {
      walletId,
      walletName: metadata.name,
      displayName: `${metadata.name}(${metadata.code})`,
      walletCode: metadata.code,
      isAdjustable: metadata.isAdjustable,
      assetCode: assetTypeInfo.code,
      assetName: assetTypeInfo.name,
      balance: '0',
      frozenBalance: '0',
      totalBalance: '0',
      updatedAt: new Date(),
      isLegacy,
      migrationTarget: isLegacy ? SYSTEM_WALLET_MIGRATION_TARGETS[walletId] : undefined,
    }
  }

  /**
   * 调整系统钱包余额
   */
  async adjustSystemWallet(
    walletId: SystemWalletID,
    assetCode: string,
    amount: Decimal,
    direction: 'INCREASE' | 'DECREASE',
    operatorId: string,
    reason: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    // 1. 查询资产类型
    const assetType = await this.walletRepository.findAssetTypeByCode(assetCode)
    if (!assetType) {
      throw new AssetTypeNotFoundException({ assetCode })
    }

    // 2. 确保系统钱包和资产存在
    await this.walletRepository.ensureSystemWallet(walletId)
    await this.walletRepository.ensureSystemWalletAsset(walletId, assetType.id)

    // 3. 查询操作前余额
    const balanceBefore = await this.getBalance(walletId, assetType.id)

    // 4. 调整余额
    const actualAmount = direction === 'INCREASE' ? amount : amount.neg()

    // 直接透传 InsufficientBalanceException (DomainException)
    await this.walletRepository.adjustBalance(walletId, assetType.id, actualAmount)

    // 5. 查询操作后余额
    const balanceAfter = await this.getBalance(walletId, assetType.id)

    // 6. 创建交易记录
    // 使用 SYSTEM_DEPOSIT/SYSTEM_WITHDRAW 作为占位符，因为 fromWalletId 和 toWalletId 不能为 null
    await this.walletRepository.createTransaction({
      fromWalletId: direction === 'DECREASE' ? walletId : SystemWalletID.SYSTEM_DEPOSIT,
      toWalletId: direction === 'INCREASE' ? walletId : SystemWalletID.SYSTEM_WITHDRAW,
      assetTypeId: assetType.id,
      amount: amount.toString(),
      type: TransactionType.ADMIN_ADJUST,
      reason,
      metadata: {
        operatorId,
        direction,
        adjustmentType: 'manual',
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        ipAddress,
        userAgent,
      },
      status: TransactionStatus.COMPLETED,
    })

    // 7. 创建审计日志
    await this.auditLogService.createLog({
      type: AuditLogType.SYSTEM_WALLET_ADJUSTED,
      operatorId,
      metadata: {
        walletId,
        walletName: SYSTEM_WALLET_NAMES[walletId] || walletId,
        assetCode,
        direction,
        amount: amount.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
        reason,
        adjustmentType: 'manual',
        ipAddress,
        userAgent,
      },
    })

    this.logger.log(
      `System wallet adjusted: wallet=${walletId}, asset=${assetCode}, direction=${direction}, amount=${amount.toString()}, operator=${operatorId}`,
    )
  }

  /**
   * 查询操作记录
   */
  async getOperationLogs(
    query: SystemWalletOperationQueryDto,
  ): Promise<PaginatedSystemWalletOperationLogDto> {
    // 调用仓储层查询
    const { logs, total } = await this.walletRepository.findSystemWalletOperationLogs({
      page: query.page,
      limit: query.limit,
      walletIds: query.walletIds,
      assetCodes: query.assetCodes,
      adjustmentType: query.adjustmentType,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    // 转换为 DTO
    const items = logs.map(log => {
      const metadata = (log.metadata as SystemWalletAdjustmentMetadata) || {}
      const direction = metadata.direction || 'INCREASE'

      // 根据 direction 确定实际被调整的钱包
      // INCREASE: fromWalletId = SYSTEM_DEPOSIT, toWalletId = 被调整的钱包
      // DECREASE: fromWalletId = 被调整的钱包, toWalletId = SYSTEM_WITHDRAW
      const walletId = (
        direction === 'INCREASE' ? log.toWalletId : log.fromWalletId
      ) as SystemWalletID

      const item: SystemWalletOperationLogDto = {
        id: log.id,
        walletId,
        walletName: SYSTEM_WALLET_NAMES[walletId] || walletId,
        assetCode: log.assetType.code,
        direction,
        adjustmentType: metadata.adjustmentType || 'manual',
        amount: log.amount.toString(),
        balanceBefore: metadata.balanceBefore || '0',
        balanceAfter: metadata.balanceAfter || '0',
        reason: log.reason || '',
        operatorId: metadata.operatorId || '',
        operatorNickname: metadata.operatorId || 'Unknown', // TODO: 联表查询 User
        createdAt: log.createdAt,
      }

      return item
    })

    return {
      total,
      page: query.page,
      limit: query.limit,
      hasNext: total > query.page * query.limit,
      items,
    }
  }

  /**
   * 获取钱包资产余额
   * @private
   */
  private async getBalance(walletId: string, assetTypeId: string): Promise<Decimal> {
    const asset = await this.walletRepository.getWalletAsset(walletId, assetTypeId)
    return asset ? new Decimal(asset.balance.toString()) : new Decimal(0)
  }

  /**
   * 获取钱包和资产元数据（用于前端选择器）
   */
  async getWalletMetadata(): Promise<WalletMetadataResponseDto> {
    // 获取所有系统钱包信息
    const systemWallets: SystemWalletMetadataDto[] = Object.entries(SYSTEM_WALLET_METADATA).map(
      ([id, metadata]) => ({
        id,
        name: metadata.name,
      }),
    )

    // 获取所有活跃资产类型
    const assetTypes = await this.walletRepository.findActiveAssetTypesSorted()
    const assetTypeDtos: AssetTypeMetadataDto[] = assetTypes.map(at => ({
      code: at.code,
      name: at.name,
    }))

    return {
      systemWallets,
      assetTypes: assetTypeDtos,
    }
  }
}
