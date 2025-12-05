import { Injectable } from '@nestjs/common'
import { WalletRepository } from '../repositories/wallet.repository'
import { TransactionType, Prisma, SystemWalletID } from '@prisma/client'
import { normalizeAmountByAsset } from '@ai/shared'
import { SYSTEM_WALLET_COMPAT_GROUPS } from '../constants/system-wallet-compat'
import {
  SystemWalletCompatibilitySummaryDto,
  SystemWalletMigrationMonitorItemDto,
  SystemWalletCompatibilityGroupDto,
  SystemWalletBalanceBreakdownDto,
} from '../dto/responses/wallet.statistics.response.dto'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

@Injectable()
export class WalletStatisticsService {
  constructor(private readonly walletRepository: WalletRepository) {}

  /**
   * 获取今日钱包统计数据
   * 
   * 重要：使用 UTC 时间计算今日范围，而非服务器本地时间
   * - today: UTC 00:00:00
   * - tomorrow: UTC 次日 00:00:00
   * 
   * 确保所有时区的管理员看到的是同一套"今日"数据
   */
  async getTodayStatistics() {
    const today = dayjs.utc().startOf('day').toDate()
    const tomorrow = dayjs.utc().startOf('day').add(1, 'day').toDate()

    const [recharge, withdraw, commission, consumption, systemWalletSnapshot] = await Promise.all([
      this.getStats(today, tomorrow, [TransactionType.RECHARGE]),
      this.getStats(today, tomorrow, [TransactionType.WITHDRAW]),
      this.getStats(today, tomorrow, [TransactionType.COMMISSION]),
      this.getStats(today, tomorrow, [TransactionType.CONSUMPTION]),
      this.buildSystemWalletCompatibilitySnapshot(),
    ])

    return {
      recharge: this.groupByAsset(recharge),
      withdraw: this.groupByAsset(withdraw),
      commission: this.groupByAsset(commission),
      consumption: this.groupByAsset(consumption),
      systemWalletRollup: systemWalletSnapshot.rollup,
      migrationMonitor: systemWalletSnapshot.monitor,
    }
  }

  /**
   * 获取指定时间范围的统计数据
   */
  private async getStats(startDate: Date, endDate: Date, types: TransactionType[]) {
    return this.walletRepository.getTransactionStatsByType({
      startDate,
      endDate,
      types,
    })
  }

  /**
   * 将统计结果按资产代码分组
   */
  private groupByAsset(stats: { assetCode: string; total: Prisma.Decimal }[]) {
    return stats.reduce(
      (acc, s) => {
        acc[s.assetCode] = s.total.toString()
        return acc
      },
      {} as Record<string, string>,
    )
  }

  private async buildSystemWalletCompatibilitySnapshot(): Promise<{
    rollup?: SystemWalletCompatibilitySummaryDto
    monitor: SystemWalletMigrationMonitorItemDto[]
  }> {
    const monitor: SystemWalletMigrationMonitorItemDto[] = []

    const groups = SYSTEM_WALLET_COMPAT_GROUPS
    if (groups.length === 0) {
      return { monitor }
    }

    const walletIds = new Set<SystemWalletID>()
    for (const group of groups) {
      walletIds.add(group.primary)
      group.legacy.forEach(id => walletIds.add(id))
    }

    const assets = await this.walletRepository.findSystemWalletAssets([...walletIds])
    const accumulators = this.buildAccumulatorMap(assets)

    const rollup: Partial<Record<CompatGroupKey, SystemWalletCompatibilityGroupDto>> = {}

    for (const group of groups) {
      const primaryAcc = this.getAccumulator(accumulators, group.primary)
      const legacyAccs = group.legacy.map(id => ({
        walletId: id,
        accumulator: this.getAccumulator(accumulators, id),
      }))

      const combinedBalanceMap = this.mergeBalanceMaps([
        primaryAcc.balance,
        ...legacyAccs.map(item => item.accumulator.balance),
      ])

      const combinedRecord = this.mapToAssetStatistics(combinedBalanceMap)
      const legacyShare: Record<string, string> = {}

      for (const assetTypeId of group.monitorAssets) {
        const total = combinedBalanceMap.get(assetTypeId) ?? new Prisma.Decimal(0)
        const legacyTotal = legacyAccs.reduce((acc, item) => {
          const value = item.accumulator.balance.get(assetTypeId)
          return value ? acc.add(value) : acc
        }, new Prisma.Decimal(0))

        const share = total.gt(0) ? legacyTotal.div(total) : new Prisma.Decimal(0)
        legacyShare[assetTypeId] = share.toFixed(6)

        monitor.push({
          groupKey: group.key,
          primaryWalletId: group.primary,
          legacyWalletIds: [...group.legacy],
          asset: assetTypeId,
          combinedBalance: normalizeAmountByAsset(assetTypeId, total.toString()),
          legacyShare: share.toFixed(6),
          note: share.gt(0)
            ? `Legacy 钱包余额占比 ${share.mul(100).toFixed(2)}%，请关注迁移进度`
            : undefined,
        } as SystemWalletMigrationMonitorItemDto)
      }

      rollup[group.key] = {
        label: group.label,
        primary: this.toBalanceBreakdownDto(group.primary, primaryAcc),
        legacy: legacyAccs.map(({ walletId, accumulator }) =>
          this.toBalanceBreakdownDto(walletId, accumulator),
        ),
        combined: combinedRecord,
        legacyShare,
      }
    }

    return {
      rollup:
        Object.keys(rollup).length > 0
          ? (rollup as SystemWalletCompatibilitySummaryDto)
          : undefined,
      monitor,
    }
  }

  private buildAccumulatorMap(
    assets: Array<{
      walletId: string
      assetTypeId: string
      balance: Prisma.Decimal
      frozenBalance: Prisma.Decimal
    }>,
  ) {
    const map = new Map<SystemWalletID, WalletAccumulator>()

    for (const asset of assets) {
      const walletId = asset.walletId as SystemWalletID
      const acc = this.getAccumulator(map, walletId)
      this.addDecimal(acc.balance, asset.assetTypeId, asset.balance)
      this.addDecimal(acc.frozen, asset.assetTypeId, asset.frozenBalance)
    }

    return map
  }

  private getAccumulator(map: Map<SystemWalletID, WalletAccumulator>, walletId: SystemWalletID) {
    if (!map.has(walletId)) {
      map.set(walletId, { balance: new Map(), frozen: new Map() })
    }

    return map.get(walletId)!
  }

  private addDecimal(
    target: Map<string, Prisma.Decimal>,
    assetTypeId: string,
    value: Prisma.Decimal,
  ) {
    const existing = target.get(assetTypeId)
    target.set(assetTypeId, existing ? existing.add(value) : new Prisma.Decimal(value))
  }

  private mergeBalanceMaps(maps: Map<string, Prisma.Decimal>[]) {
    const result = new Map<string, Prisma.Decimal>()

    for (const map of maps) {
      for (const [asset, value] of map) {
        const current = result.get(asset)
        result.set(asset, current ? current.add(value) : new Prisma.Decimal(value))
      }
    }

    return result
  }

  private mapToAssetStatistics(map: Map<string, Prisma.Decimal>) {
    const record: Record<string, string> = {}

    for (const [asset, value] of map) {
      record[asset] = normalizeAmountByAsset(asset, value.toString())
    }

    return record
  }

  private toBalanceBreakdownDto(
    walletId: SystemWalletID,
    acc: WalletAccumulator,
  ): SystemWalletBalanceBreakdownDto {
    const balance = this.mapToAssetStatistics(acc.balance)
    const frozen = this.mapToAssetStatistics(acc.frozen)

    return {
      walletId,
      balance,
      frozenBalance: Object.keys(frozen).length > 0 ? frozen : undefined,
    }
  }
}

interface WalletAccumulator {
  balance: Map<string, Prisma.Decimal>
  frozen: Map<string, Prisma.Decimal>
}

type CompatGroupKey = (typeof SYSTEM_WALLET_COMPAT_GROUPS)[number]['key']
