import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  Post,
  Body,
  HttpCode,
  Req,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { Request } from 'express'
import Decimal from 'decimal.js'
import { WalletService } from './wallet.service'
import { WalletStatisticsService } from './services/wallet-statistics.service'
import { SystemWalletAdminService } from './services/system-wallet-admin.service'
import { SystemWalletSnapshotService } from './services/system-wallet-snapshot.service'
import { WalletDetailResponseDto } from './dto/responses/wallet.detail.response.dto'
import { WalletStatisticsResponseDto } from './dto/responses/wallet.statistics.response.dto'
import { GetTransactionsRequestDto } from './dto/requests/get.transactions.request.dto'
import {
  AdminReadAny,
  AdminCreateAny,
  AdminUpdateAny,
} from '@/modules/auth/admin/decorators/access.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { AdminDepositRequestDto } from './dto/requests/admin.deposit.request.dto'
import { AdminWithdrawRequestDto } from './dto/requests/admin.withdraw.request.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.dto'
import { Transaction } from '@/common/decorators/transaction.decorator'
import { CurrentUser } from '../auth/decorators/current.user.decorator'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { AdjustSystemWalletDto } from './dto/requests/adjust-system-wallet.dto'
import { SystemWalletOperationQueryDto } from './dto/requests/system-wallet-operation-query.dto'
import { SystemWalletOverviewDto } from './dto/responses/system-wallet-overview.dto'
import { PaginatedSystemWalletOperationLogDto } from './dto/responses/system-wallet-operation-log.dto'
import { GetSnapshotTrendDto, BackfillSnapshotsDto } from './dto/requests/snapshot-query.dto'
import { SnapshotHistoryResponseDto } from './dto/responses/snapshot-history.dto'
import { WalletMetadataResponseDto } from './dto/responses/wallet-metadata.dto'
import * as dayjs from 'dayjs'
import * as utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

@ApiTags('admin')
@Controller('admin/wallets')
@ApiBearerAuth()
export class AdminWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletStatisticsService: WalletStatisticsService,
    private readonly systemWalletAdminService: SystemWalletAdminService,
    private readonly snapshotService: SystemWalletSnapshotService,
  ) {}

  @Get('users/:userId/wallet')
  @ApiOperation({ summary: '获取指定用户的钱包' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: WalletDetailResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '钱包不存在' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.WALLET)
  async getUserWallet(@Param('userId') userId: string): Promise<WalletDetailResponseDto> {
    return this.walletService.getWalletByUserId(userId)
  }

  @Get('users/:userId/transactions')
  @ApiOperation({ summary: '获取指定用户的所有交易记录（流入或流出）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: BasePaginationResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.WALLET)
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query() query: GetTransactionsRequestDto,
  ) {
    const userWallet = await this.walletService.getWalletByUserId(userId)

    // 使用新的服务方法获取所有交易
    return this.walletService.getWalletTransactions(userWallet.id, {
      assetTypeId: query.assetTypeId,
      type: query.type,
      page: query.page,
      limit: query.limit,
    })
  }

  @Post('users/deposit')
  @ApiOperation({ summary: '管理员给指定用户充值' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '充值成功',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '用户或资产类型不存在' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminCreateAny(AppResource.WALLET)
  @Transaction()
  async adminDeposit(@Body() depositDto: AdminDepositRequestDto) {
    // 获取用户钱包
    const wallet = await this.walletService.getWalletByUserId(depositDto.userId)

    // 执行充值操作
    await this.walletService.deposit(
      wallet.id,
      depositDto.assetTypeId,
      depositDto.amount,
      true,
      depositDto.reason || '管理员充值',
      depositDto.metadata,
      depositDto.uniqueId,
    )

    return { success: true, message: '充值成功' }
  }

  @Post('users/withdraw')
  @ApiOperation({ summary: '管理员从指定用户提取资产' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '提取成功',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '用户或资产类型不存在' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminCreateAny(AppResource.WALLET)
  @Transaction()
  async adminWithdraw(@Body() withdrawDto: AdminWithdrawRequestDto) {
    // 获取用户钱包
    const wallet = await this.walletService.getWalletByUserId(withdrawDto.userId)

    // 执行提取操作
    await this.walletService.withdraw(
      wallet.id,
      withdrawDto.assetTypeId,
      withdrawDto.amount,
      true,
      withdrawDto.reason || '管理员提取',
      withdrawDto.metadata,
      withdrawDto.uniqueId,
    )

    return { success: true, message: '提取成功' }
  }

  @Get('statistics/today')
  @ApiOperation({ summary: '获取今日钱包统计数据' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: WalletStatisticsResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.WALLET)
  async getTodayStatistics(): Promise<WalletStatisticsResponseDto> {
    return this.walletStatisticsService.getTodayStatistics()
  }

  @Get('system/overview')
  @ApiOperation({ summary: '获取所有系统钱包余额概览' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: SystemWalletOverviewDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.SYSTEM_WALLET)
  async getSystemWalletsOverview(): Promise<SystemWalletOverviewDto> {
    return this.systemWalletAdminService.getSystemWalletsOverview()
  }

  @Post('system/adjust')
  @ApiOperation({ summary: '管理员调整系统钱包余额' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '调整成功',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '资产类型不存在' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminUpdateAny(AppResource.SYSTEM_WALLET)
  @Transaction()
  @HttpCode(HttpStatus.NO_CONTENT)
  async adjustSystemWallet(
    @Body() dto: AdjustSystemWalletDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const forwardedFor = req.headers['x-forwarded-for']
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
    const ip = forwardedIp?.split(',')[0]?.trim() ?? req.ip ?? 'unknown'

    await this.systemWalletAdminService.adjustSystemWallet(
      dto.walletId,
      dto.assetCode,
      new Decimal(dto.amount),
      dto.direction,
      admin.id,
      dto.reason,
      ip,
      req.headers['user-agent'] ?? 'unknown',
    )
  }

  @Get('system/operations')
  @ApiOperation({ summary: '查询系统钱包操作记录' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: PaginatedSystemWalletOperationLogDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.SYSTEM_WALLET)
  async getSystemWalletOperations(
    @Query() query: SystemWalletOperationQueryDto,
  ): Promise<PaginatedSystemWalletOperationLogDto> {
    return this.systemWalletAdminService.getOperationLogs(query)
  }

  @Get('metadata')
  @ApiOperation({ summary: '获取钱包和资产元数据（用于前端选择器）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: WalletMetadataResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.SYSTEM_WALLET)
  async getWalletMetadata(): Promise<WalletMetadataResponseDto> {
    return this.systemWalletAdminService.getWalletMetadata()
  }

  @Get('snapshots/trend')
  @ApiOperation({ summary: '获取系统钱包快照趋势（用于图表）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: SnapshotHistoryResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminReadAny(AppResource.SYSTEM_WALLET)
  async getSnapshotTrend(@Query() query: GetSnapshotTrendDto): Promise<SnapshotHistoryResponseDto> {
    return this.snapshotService.getSnapshotTrend(
      query.groupBy,
      query.timeRange,
      query.walletId,
      query.assetCode,
    )
  }

  @Post('snapshots/manual')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动生成当前小时快照（管理员）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '快照生成成功',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @Transaction()
  @AdminUpdateAny(AppResource.SYSTEM_WALLET)
  async createManualSnapshot(): Promise<{ success: boolean; count: number; date: string }> {
    const targetTime = dayjs.utc().startOf('hour')
    const count = await this.snapshotService.createHourlySnapshot(targetTime.toDate())

    return { success: true, count, date: targetTime.toISOString() }
  }

  @Post('snapshots/backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '回填历史快照（管理员）' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '回填成功',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: '禁止访问' })
  @AdminUpdateAny(AppResource.WALLET)
  async backfillSnapshots(
    @Body() dto: BackfillSnapshotsDto,
  ): Promise<{ success: boolean; totalDays: number; totalRecords: number }> {
    const result = await this.snapshotService.backfillSnapshots(dto.startDate, dto.endDate)
    return { success: true, ...result }
  }
}
