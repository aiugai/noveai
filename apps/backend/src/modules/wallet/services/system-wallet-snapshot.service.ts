import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { WalletRepository } from '../repositories/wallet.repository'
import { SystemWalletID, SystemWalletSnapshot, AssetType, Prisma } from '@prisma/client'
import { AssetCode, SnapshotGroupBy } from '@ai/shared'
import Decimal from 'decimal.js'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'
import {
  SnapshotHistoryResponseDto,
  SnapshotTrendDto,
  SnapshotDataPointDto,
} from '../dto/responses/snapshot-history.dto'
import { InvalidDateRangeException } from '../exceptions'

dayjs.extend(utc)

/**
 * 快照查询结果类型（包含关联的资产类型）
 */
type SnapshotWithAssetType = SystemWalletSnapshot & {
  assetType: AssetType
}

@Injectable()
export class SystemWalletSnapshotService {
  private readonly logger = new Logger(SystemWalletSnapshotService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletRepository: WalletRepository,
  ) {}

  /**
   * 生成指定小时的快照（默认当前小时）
   * @param targetTime 快照时间，默认为当前 UTC 小时
   * @returns 生成的快照数量
   */
  async createHourlySnapshot(targetTime?: Date): Promise<number> {
    const snapshotTime = targetTime
      ? dayjs.utc(targetTime).startOf('hour').toDate()
      : dayjs.utc().startOf('hour').toDate()

    const timeStr = snapshotTime.toISOString()
    this.logger.log(`Creating snapshot for time: ${timeStr}`)

    const allWalletIds = Object.values(SystemWalletID)
    const assets = await this.walletRepository.findSystemWalletAssets(allWalletIds)

    if (assets.length === 0) {
      this.logger.warn(`No system wallet assets found for snapshot at ${timeStr}`)
      return 0
    }

    const snapshots = assets.map(asset => ({
      snapshotAt: snapshotTime,
      walletId: asset.walletId,
      assetTypeId: asset.assetTypeId,
      balance: asset.balance,
      frozenBalance: asset.frozenBalance,
    }))

    const tx = this.prisma.getClient()
    const result = await tx.systemWalletSnapshot.createMany({
      data: snapshots,
      skipDuplicates: true,
    })

    this.logger.log(
      `Created ${result.count} snapshots for time ${timeStr} (${assets.length} assets queried)`,
    )
    return result.count
  }

  /**
   * @deprecated 请使用 {@link createHourlySnapshot}
   */
  async createDailySnapshot(targetDate?: Date): Promise<number> {
    this.logger.warn('createDailySnapshot is deprecated. Use createHourlySnapshot instead.')

    const snapshotTime = targetDate
      ? dayjs.utc(targetDate).startOf('day').toDate()
      : dayjs.utc().startOf('day').toDate()

    return this.createHourlySnapshot(snapshotTime)
  }

  /**
   * 获取快照趋势（用于图表）
   * @param groupBy 分组粒度（hour/day）
   * @param timeRange 时间跨度（按 groupBy 解释为小时数或天数）
   * @param walletId 可选的系统钱包ID（指定后只返回该钱包数据）
   * @param assetCode 可选的资产代码（指定后只返回该资产数据）
   * @returns 按资产类型聚合的趋势数据（如果指定了 walletId 和 assetCode，则只返回单个钱包单个资产的趋势）
   */
  async getSnapshotTrend(
    groupBy: SnapshotGroupBy = SnapshotGroupBy.Day,
    timeRange: number = 30,
    walletId?: SystemWalletID,
    assetCode?: AssetCode,
  ): Promise<SnapshotHistoryResponseDto> {
    const now = dayjs.utc()
    const { startTime, endTime } = this.calculateTimeRange(now, groupBy, timeRange)

    this.logger.log(
      `Fetching snapshot trend: groupBy=${groupBy}, range=${timeRange}, from ${startTime.format('YYYY-MM-DD HH:mm:ss')} to ${endTime.format('YYYY-MM-DD HH:mm:ss')}${walletId ? `, walletId=${walletId}` : ''}${assetCode ? `, assetCode=${assetCode}` : ''}`,
    )

    const tx = this.prisma.getClient()

    const where: Prisma.SystemWalletSnapshotWhereInput = {
      snapshotAt: {
        gte: startTime.toDate(),
        lte: endTime.toDate(),
      },
    }

    if (walletId) {
      where.walletId = walletId
    }

    if (assetCode) {
      const assetType = await this.walletRepository.findAssetTypeByCode(assetCode)
      if (assetType) {
        where.assetTypeId = assetType.id
      } else {
        this.logger.warn(`Asset type not found: ${assetCode}`)
        return { trends: [] }
      }
    }

    const snapshots = await tx.systemWalletSnapshot.findMany({
      where,
      include: {
        assetType: true,
      },
      orderBy: {
        snapshotAt: 'asc',
      },
    })

    if (snapshots.length === 0) {
      this.logger.warn('No snapshots found for the specified criteria')
      return { trends: [] }
    }

    if (groupBy === SnapshotGroupBy.Hour) {
      if (walletId && assetCode) {
        return this.buildSingleWalletTrend(snapshots, 'hour')
      }

      return this.buildAggregatedTrends(snapshots, 'hour')
    }

    const dailySnapshots = this.aggregateSnapshotsByDay(snapshots)

    if (walletId && assetCode) {
      return this.buildSingleWalletTrend(dailySnapshots, 'day')
    }

    return this.buildAggregatedTrends(dailySnapshots, 'day')
  }

  private calculateTimeRange(
    now: dayjs.Dayjs,
    groupBy: SnapshotGroupBy,
    timeRange: number,
  ): { startTime: dayjs.Dayjs; endTime: dayjs.Dayjs } {
    if (groupBy === SnapshotGroupBy.Hour) {
      const endTime = now.startOf('hour')
      const startTime = endTime.subtract(timeRange - 1, 'hour')
      return { startTime, endTime }
    }

    const endTime = now.subtract(1, 'day').endOf('day')
    const startTime = endTime.subtract(timeRange - 1, 'day').startOf('day')
    return { startTime, endTime }
  }

  private aggregateSnapshotsByDay(
    snapshots: SnapshotWithAssetType[],
  ): SnapshotWithAssetType[] {
    const dailyMap = new Map<string, SnapshotWithAssetType>()

    for (const snap of snapshots) {
      const dateKey = dayjs.utc(snap.snapshotAt).format('YYYY-MM-DD')
      const key = `${dateKey}_${snap.walletId}_${snap.assetTypeId}`

      const existing = dailyMap.get(key)
      if (!existing || snap.snapshotAt > existing.snapshotAt) {
        dailyMap.set(key, snap)
      }
    }

    return Array.from(dailyMap.values()).sort(
      (a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime(),
    )
  }

  /**
   * 构建单个钱包单个资产的趋势数据（计算余额变化量）
   * @private
   */
  private buildSingleWalletTrend(
    snapshots: SnapshotWithAssetType[],
    granularity: 'hour' | 'day',
  ): SnapshotHistoryResponseDto {
    if (snapshots.length === 0) {
      return { trends: [] }
    }

    const assetType = snapshots[0].assetType
    const dataPoints: SnapshotDataPointDto[] = []

    const sortedSnapshots = snapshots.sort(
      (a, b) => a.snapshotAt.getTime() - b.snapshotAt.getTime(),
    )

    let previousTotal = new Decimal(0)

    for (let i = 0; i < sortedSnapshots.length; i++) {
      const snap = sortedSnapshots[i]
      const currentTotal = new Decimal(snap.balance.toString()).add(
        new Decimal(snap.frozenBalance.toString()),
      )

      const balanceChange = i === 0 ? new Decimal(0) : currentTotal.sub(previousTotal)

      const dateStr =
        granularity === 'hour'
          ? dayjs.utc(snap.snapshotAt).format('YYYY-MM-DD HH:00')
          : dayjs.utc(snap.snapshotAt).format('YYYY-MM-DD')

      dataPoints.push({
        date: dateStr,
        totalBalance: currentTotal.toString(),
        availableBalance: new Decimal(snap.balance.toString()).toString(),
        frozenBalance: new Decimal(snap.frozenBalance.toString()).toString(),
        balanceChange: balanceChange.toString(),
      })

      previousTotal = currentTotal
    }

    return {
      trends: [
        {
          assetCode: assetType.code,
          assetName: assetType.name,
          dataPoints,
        },
      ],
    }
  }

  /**
   * 构建聚合趋势数据（按资产类型汇总所有钱包）
   * @private
   */
  private buildAggregatedTrends(
    snapshots: SnapshotWithAssetType[],
    granularity: 'hour' | 'day',
  ): SnapshotHistoryResponseDto {
    const assetMap = new Map<
      string,
      {
        code: string
        name: string
        points: Map<string, { total: Decimal; available: Decimal; frozen: Decimal }>
      }
    >()

    for (const snap of snapshots) {
      const assetKey = snap.assetType.code
      if (!assetMap.has(assetKey)) {
        assetMap.set(assetKey, {
          code: snap.assetType.code,
          name: snap.assetType.name,
          points: new Map(),
        })
      }

      const timeKey =
        granularity === 'hour'
          ? dayjs.utc(snap.snapshotAt).format('YYYY-MM-DD HH:00')
          : dayjs.utc(snap.snapshotAt).format('YYYY-MM-DD')

      const asset = assetMap.get(assetKey)!
      const existing = asset.points.get(timeKey) || {
        total: new Decimal(0),
        available: new Decimal(0),
        frozen: new Decimal(0),
      }

      asset.points.set(timeKey, {
        total: existing.total
          .add(new Decimal(snap.balance.toString()))
          .add(new Decimal(snap.frozenBalance.toString())),
        available: existing.available.add(new Decimal(snap.balance.toString())),
        frozen: existing.frozen.add(new Decimal(snap.frozenBalance.toString())),
      })
    }

    const trends: SnapshotTrendDto[] = Array.from(assetMap.values()).map(asset => {
      const sortedPoints = Array.from(asset.points.entries()).sort(([timeA], [timeB]) =>
        timeA.localeCompare(timeB),
      )

      let previousTotal = new Decimal(0)
      const dataPoints: SnapshotDataPointDto[] = sortedPoints.map(([time, point], index) => {
        const balanceChange = index === 0 ? new Decimal(0) : point.total.sub(previousTotal)
        previousTotal = point.total

        return {
          date: time,
          totalBalance: point.total.toString(),
          availableBalance: point.available.toString(),
          frozenBalance: point.frozen.toString(),
          balanceChange: balanceChange.toString(),
        }
      })

      return {
        assetCode: asset.code,
        assetName: asset.name,
        dataPoints,
      }
    })

    trends.sort((a, b) => a.assetCode.localeCompare(b.assetCode))

    this.logger.log(
      `Fetched snapshot trend for ${trends.length} assets with granularity=${granularity}`,
    )
    return { trends }
  }

  /**
   * 手动回填历史快照
   * @param startDate 开始日期（YYYY-MM-DD）
   * @param endDate 结束日期（YYYY-MM-DD）
   * 
   * 注意：回填时使用当日 UTC 23:00（当日最后整点），
   * 与日级趋势聚合逻辑保持一致（取当日最新快照），
   * 确保代表"收盘"而非"开盘"数据。
   */
  async backfillSnapshots(
    startDate: string,
    endDate: string,
  ): Promise<{ totalDays: number; totalRecords: number }> {
    const start = dayjs.utc(startDate).startOf('day')
    const end = dayjs.utc(endDate).startOf('day')

    if (start.isAfter(end)) {
      throw new InvalidDateRangeException({ startDate, endDate })
    }

    const totalDays = end.diff(start, 'day') + 1

    this.logger.log(`Backfilling snapshots from ${startDate} to ${endDate} (${totalDays} days)`)

    let totalRecords = 0
    let currentDate = start

    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
      // 使用当日 UTC 23:00（当日最后整点），与日级趋势"取当日最新快照"的语义一致
      const endOfDayHour = currentDate.endOf('day').startOf('hour')
      const count = await this.createHourlySnapshot(endOfDayHour.toDate())
      totalRecords += count
      currentDate = currentDate.add(1, 'day')
    }

    this.logger.log(`Backfill completed: ${totalDays} days, ${totalRecords} total records created`)
    return { totalDays, totalRecords }
  }
}
