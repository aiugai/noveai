import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode, AssetCode, normalizeAmountByAsset, normalizeToFixed  } from '@ai/shared'
import { Prisma, AssetType, TransactionStatus, TransactionType, SystemWalletID  } from '@prisma/client'
import { WalletRepository } from './repositories/wallet.repository'
import { TransferAssetRequestDto } from './dto/requests/transfer.asset.request.dto'
import { WalletBalanceResponseDto } from './dto/responses/wallet.balance.response.dto'
import { WalletDetailResponseDto } from './dto/responses/wallet.detail.response.dto'
import { AssetBalanceResponseDto } from './dto/responses/asset.balance.response.dto'
import { IWallet } from './interfaces/wallet.interface'
import Decimal from 'decimal.js'
import { SettingsService } from '../settings/services/settings.service'
import { ConfigService } from '@nestjs/config'
import { SYSTEM_WALLET_ID_SET } from './constants/system-wallet-compat'

// Prisma 7 兼容：从 Prisma 命名空间获取错误类型（值和类型）
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError

export interface NextConversationBalanceCheckResult {
  hasEnough: boolean
  requiredAmount: string
  currentBalance: string
}

// 注意：事务边界由控制器或显式使用 Cls + prisma.runInTransaction 的调用方负责。
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name)

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  private async resolveAssetTypeId(assetTypeIdOrCode: string): Promise<string> {
    if (!assetTypeIdOrCode) {
      throw new DomainException('Asset type cannot be empty', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    const byId = await this.walletRepository.findAssetTypeById(assetTypeIdOrCode)
    if (byId) {
      return byId.id
    }

    const byCode = await this.walletRepository.findAssetTypeByCode(assetTypeIdOrCode)
    if (byCode) {
      return byCode.id
    }

    throw new DomainException(`Asset type ${assetTypeIdOrCode} does not exist`, {
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    })
  }

  async checkBalanceByCode(userId: string, assetCode: string, amount: Decimal): Promise<boolean> {
    const assetType = await this.walletRepository.findAssetTypeByCode(assetCode)
    if (!assetType) {
      throw new DomainException(`Asset type code ${assetCode} does not exist`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return this.checkBalance(userId, assetType.id, amount)
  }

  public async findAssetTypeByCode(code: string): Promise<AssetType | null> {
    return this.walletRepository.findAssetTypeByCode(code)
  }

  /**
   * 返回当前启用的资产类型代码列表（按 sortOrder 升序）
   */
  public async listActiveAssetTypeCodes(): Promise<string[]> {
    const types = await this.walletRepository.findActiveAssetTypesSorted()
    return types.map(t => t.code)
  }

  /**
   * Creates a wallet for a given user.
   * Note: This operation is currently not part of the caller's transaction.
   * @param userId The ID of the user.
   * @returns The created or existing wallet.
   */
  async createWallet(userId: string): Promise<IWallet> {
    // Check if wallet already exists for the user
    const existingWallet = await this.walletRepository.findByUserId(userId)
    if (existingWallet) {
      // 已存在则返回现有钱包（幂等处理）
      this.logger.warn(`Wallet already exists for user ${userId}, returning existing.`)
      return existingWallet
    }

    // Create a new wallet using the repository
    const wallet = await this.walletRepository.create({ userId })

    // 获取启用的资产类型（按 sortOrder 升序，越小优先）
    const activeAssetTypes = await this.walletRepository.findActiveAssetTypesSorted()

    // 创建资产类型ID集合，用于批量创建
    const assetTypeIds = activeAssetTypes.map(assetType => assetType.id)

    // 批量创建资产记录（替代“默认资产”语义）
    const createPromises = assetTypeIds.map(assetTypeId =>
      this.walletRepository
        .createWalletAsset({
          walletId: wallet.id,
          assetTypeId,
          balance: '0',
          frozenBalance: '0',
        })
        .catch(error => {
          // 记录错误但不阻止流程继续
          this.logger.warn(
            `创建资产记录失败 - 钱包ID: ${wallet.id}, 资产类型ID: ${assetTypeId}, 错误: ${error.message}`,
          )
          return null
        }),
    )

    // 并行执行创建操作
    await Promise.all(createPromises)

    return wallet
  }

  async getWalletById(id: string): Promise<IWallet> {
    const wallet = await this.walletRepository.findById(id)
    if (!wallet) {
      throw new DomainException('Wallet not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return wallet
  }

  async getWalletByUserId(userId: string): Promise<WalletDetailResponseDto> {
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      this.logger.warn(`Wallet not found for user ${userId}`)
      throw new DomainException('Wallet not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    // 获取钱包的所有资产余额
    const walletAssets = await this.walletRepository.findWalletAssetsByWalletId(wallet.id)

    // 转换为 DTO
    const assets: AssetBalanceResponseDto[] = walletAssets.map(asset => {
      const assetCode = asset.assetType.code
      const balance = this.toAssetAmountString(assetCode, asset.balance)
      const frozenBalance = this.toAssetAmountString(assetCode, asset.frozenBalance)
      const totalBalance = this.toAssetAmountString(
        assetCode,
        new Decimal(asset.balance as any).add(new Decimal(asset.frozenBalance as any)),
      )
      return {
        assetTypeId: asset.assetTypeId,
        code: assetCode,
        balance,
        frozenBalance,
        totalBalance,
        sortOrder: (asset.assetType as any).sortOrder as number,
      }
    })

    return {
      id: wallet.id,
      userId: wallet.userId,
      assets,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  async grantAgentCommissionUSDT(
    agentUserId: string,
    amount: string,
    referenceId?: string,
    level?: number,
  ): Promise<void> {
    const usdtAssetType = await this.walletRepository.findAssetTypeByCode('USDT')
    if (!usdtAssetType) {
      throw new DomainException('USDT asset type not configured', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    let agentWallet = await this.walletRepository.findByUserId(agentUserId)
    if (!agentWallet) {
      agentWallet = await this.createWallet(agentUserId)
    }

    const uniqueIdSegments = ['agent-commission']
    if (referenceId) {
      uniqueIdSegments.push(referenceId)
    } else {
      uniqueIdSegments.push(
        agentUserId,
        Date.now().toString(36),
        Math.random().toString(36).slice(2, 8),
      )
    }
    if (typeof level === 'number') {
      uniqueIdSegments.push(`L${level}`)
    }
    const uniqueId = uniqueIdSegments.join(':')

    await this.transferAsset({
      fromWalletId: SystemWalletID.SYSTEM_COMMISSION,
      toWalletId: agentWallet.id,
      assetTypeId: usdtAssetType.id,
      amount,
      type: TransactionType.COMMISSION,
      reason: 'Agent commission payout',
      metadata: {
        referenceId,
        level,
      },
      uniqueId,
      isFromFreeze: false,
      isToFreeze: false,
    })
  }

  async getWalletBalance(walletId: string, assetTypeId: string): Promise<WalletBalanceResponseDto> {
    const walletAsset = await this.walletRepository.getWalletAssetWithType(walletId, assetTypeId)
    if (!walletAsset) {
      return {
        walletId,
        assetTypeId,
        code: '',
        balance: '0.000000',
        frozenBalance: '0.000000',
        totalBalance: '0.000000',
      }
    }
    const assetCode = walletAsset.assetType.code
    const balance = this.toAssetAmountString(assetCode, walletAsset.balance)
    const frozenBalance = this.toAssetAmountString(assetCode, walletAsset.frozenBalance)
    const totalBalance = this.toAssetAmountString(
      assetCode,
      new Decimal(walletAsset.balance as any).add(new Decimal(walletAsset.frozenBalance as any)),
    )
    return {
      walletId,
      assetTypeId,
      code: assetCode,
      balance,
      frozenBalance,
      totalBalance,
    }
  }

  /**
   * 检查指定用户的钱包中特定资产的余额是否充足。
   * @param userId 需要检查余额的用户ID。
   * @param assetTypeId 需要检查余额的资产类型ID。
   * @param amount 需要的金额。
   * @returns 如果余额充足则返回 true，否则返回 false。
   */
  async checkBalance(userId: string, assetTypeId: string, amount: Decimal): Promise<boolean> {
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      // 或者抛出异常，取决于期望的行为
      this.logger.warn(`检查余额时未找到用户 ${userId} 的钱包。`)
      return false
    }

    const walletAsset = await this.walletRepository.getWalletAsset(wallet.id, assetTypeId)
    if (!walletAsset) {
      // 如果资产不存在，则余额为 0
      this.logger.warn(`钱包 ${wallet.id} 中未找到资产 ${assetTypeId}。假设余额为 0。`)
      // 设计意图：仅当所需金额为 0 或负数时算“充足”（无正向额度需求）
      return amount.isZero() || amount.isNegative()
    }

    const availableBalance = new Decimal(walletAsset.balance)
    // 检查可用余额是否 >= 所需金额
    return availableBalance.gte(amount)
  }

  /**
   * 检查钱包余额是否足够下一次对话，并返回当前余额信息
   */
  async checkBalanceForNextConversation(
    userId: string,
  ): Promise<NextConversationBalanceCheckResult> {
    const defaultRequired = new Decimal(2)
    const appEnv = this.configService.get<string>('app.appEnv')
    const formatAmount = (value: Decimal) =>
      normalizeAmountByAsset(AssetCode.SCORE, value.toString())

    if (appEnv === 'test' || appEnv === 'e2e') {
      return {
        hasEnough: true,
        requiredAmount: formatAmount(defaultRequired),
        currentBalance: formatAmount(defaultRequired),
      }
    }

    const minScoreForNextConversation = await this.settingsService.get<number>(
      'next.conversation.min.score',
    )
    const requiredAmount = new Decimal(minScoreForNextConversation ?? defaultRequired)

    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      this.logger.warn(`检查对话余额时未找到用户 ${userId} 的钱包。`)
      return {
        hasEnough: false,
        requiredAmount: formatAmount(requiredAmount),
        currentBalance: formatAmount(new Decimal(0)),
      }
    }

    const assetType = await this.walletRepository.findAssetTypeByCode(AssetCode.SCORE)
    if (!assetType) {
      throw new DomainException(`Asset type code ${AssetCode.SCORE} does not exist`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    const walletAsset = await this.walletRepository.getWalletAsset(wallet.id, assetType.id)
    const currentBalanceDecimal = walletAsset ? new Decimal(walletAsset.balance) : new Decimal(0)

    return {
      hasEnough: currentBalanceDecimal.gte(requiredAmount),
      requiredAmount: formatAmount(requiredAmount),
      currentBalance: formatAmount(currentBalanceDecimal),
    }
  }

  /**
   * 转账前的预检查
   * @param toWalletId 转入钱包ID
   * @param assetTypeId 资产类型ID
   */
  private async precheck(toWalletId: string, assetTypeId: string): Promise<void> {
    // 检查钱包资产是否存在，如果不存在则创建
    const walletAsset = await this.walletRepository.getWalletAsset(toWalletId, assetTypeId)
    if (!walletAsset) {
      try {
        await this.walletRepository.createWalletAsset({
          walletId: toWalletId,
          assetTypeId,
          balance: '0',
          frozenBalance: '0',
        })
      } catch (error) {
        if (!(error instanceof PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error
        }
      }
    }
  }

  private async ensureBothAssets(
    fromWalletId: string | null | undefined,
    toWalletId: string,
    assetTypeId: string,
  ): Promise<void> {
    const walletIds = new Set<string>()
    if (fromWalletId) {
      walletIds.add(fromWalletId)
    }
    if (toWalletId) {
      walletIds.add(toWalletId)
    }

    for (const walletId of walletIds) {
      await this.ensureSystemWalletInfrastructure(walletId, assetTypeId)
      await this.precheck(walletId, assetTypeId)
    }
  }

  private isSystemWalletId(walletId?: string | null): walletId is SystemWalletID {
    return Boolean(walletId && SYSTEM_WALLET_ID_SET.has(walletId))
  }

  private async ensureSystemWalletInfrastructure(
    walletId: string | null | undefined,
    assetTypeId?: string,
  ): Promise<void> {
    if (!this.isSystemWalletId(walletId)) {
      return
    }

    await this.walletRepository.ensureSystemWallet(walletId)

    if (assetTypeId) {
      await this.walletRepository.ensureSystemWalletAsset(walletId, assetTypeId)
    }
  }

  private normalizePositiveAmount(assetTypeId: string, value: unknown): string {
    const normalized = normalizeAmountByAsset(assetTypeId, value)
    if (!new Decimal(normalized).gt(0)) {
      throw new DomainException('Amount must be greater than 0', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }
    return normalized
  }

  async transferAsset(transferDto: TransferAssetRequestDto): Promise<void> {
    const assetTypeId = await this.resolveAssetTypeId(transferDto.assetTypeId)
    const amountStr = this.normalizePositiveAmount(assetTypeId, transferDto.amount)

    await this.ensureBothAssets(transferDto.fromWalletId, transferDto.toWalletId, assetTypeId)

    await this.walletRepository.transferBalance(
      transferDto.fromWalletId,
      transferDto.toWalletId,
      assetTypeId,
      amountStr,
      transferDto.isFromFreeze || false,
      transferDto.isToFreeze || false,
    )

    try {
      await this.walletRepository.createTransaction({
        fromWalletId: transferDto.fromWalletId,
        toWalletId: transferDto.toWalletId,
        assetTypeId,
        amount: amountStr,
        type: transferDto.type,
        reason: transferDto.reason,
        metadata: transferDto.metadata,
        uniqueId: transferDto.uniqueId,
        status: TransactionStatus.COMPLETED,
      })
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        transferDto.uniqueId
      ) {
        this.logger.debug(`幂等兜底：uniqueId=${transferDto.uniqueId} 触发唯一键冲突，视为成功`)
        return
      }
      throw error
    }
  }

  /**
   * 获取指定钱包的所有收支交易记录（既作为发送方也作为接收方）
   */
  async getWalletTransactions(
    walletId: string,
    params: {
      assetTypeId?: string
      type?: TransactionType
      page: number
      limit: number
    },
  ) {
    return this.walletRepository.findWalletTransactions(walletId, params)
  }

  /**
   * 通过唯一ID查找交易记录
   * @param uniqueId 交易唯一ID
   * @returns 交易记录或null
   */
  async getTransactionByUniqueId(uniqueId: string) {
    return this.walletRepository.findTransactionByUniqueId(uniqueId)
  }

  async frozenAsset(
    walletId: string,
    assetTypeId: string,
    amount: number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    this.logger.debug(
      `frozenAsset() enter walletId=${walletId} assetTypeId=${assetTypeId} amount=${amount} uniqueId=${uniqueId}`,
    )
    // 统一规范化金额字符串（资产级精度）
    const amountStr = this.normalizePositiveAmount(assetTypeId, amount)
    // 执行冻结操作
    try {
      await this.walletRepository.transferBalance(
        walletId,
        walletId,
        assetTypeId,
        amountStr,
        false,
        true,
      )

      // 创建交易记录
      await this.walletRepository.createTransaction({
        fromWalletId: walletId,
        toWalletId: walletId,
        assetTypeId,
        amount: amountStr,
        type: TransactionType.FREEZE,
        reason,
        metadata,
        uniqueId,
        status: TransactionStatus.COMPLETED,
      })
      this.logger.debug(
        `frozenAsset() success walletId=${walletId} assetTypeId=${assetTypeId} amount=${amount} uniqueId=${uniqueId}`,
      )
    } catch (error) {
      this.logger.error(
        `冻结资产失败 - 钱包ID: ${walletId}, 资产类型: ${assetTypeId}, 金额: ${amount}, 错误: ${error.message}`,
      )
      throw error
    }
  }

  async unfrozenAsset(
    walletId: string,
    assetTypeId: string,
    amount: string | number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    const amountStr = this.normalizePositiveAmount(assetTypeId, amount)
    await this.walletRepository.transferBalance(
      walletId,
      walletId,
      assetTypeId,
      amountStr,
      true,
      false,
    )

    // 创建交易记录
    await this.walletRepository.createTransaction({
      fromWalletId: walletId,
      toWalletId: walletId,
      assetTypeId,
      amount: amountStr,
      type: TransactionType.UNFREEZE,
      reason,
      metadata,
      uniqueId,
      status: TransactionStatus.COMPLETED,
    })
  }

  async withdraw(
    walletId: string,
    assetTypeId: string,
    amount: string | number,
    isCompleted: boolean,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        this.logger.debug(`幂等命中：uniqueId=${uniqueId}，跳过操作`)
        return
      }
    }

    const resolvedAssetTypeId = await this.resolveAssetTypeId(assetTypeId)

    await this.ensureBothAssets(walletId, SystemWalletID.SYSTEM_WITHDRAW, resolvedAssetTypeId)

    const amountStr = this.normalizePositiveAmount(resolvedAssetTypeId, amount)

    await this.walletRepository.transferBalance(
      walletId,
      SystemWalletID.SYSTEM_WITHDRAW,
      resolvedAssetTypeId,
      amountStr,
      false,
      false,
    )

    try {
      await this.walletRepository.createTransaction({
        fromWalletId: walletId,
        toWalletId: SystemWalletID.SYSTEM_WITHDRAW,
        assetTypeId: resolvedAssetTypeId,
        amount: amountStr,
        type: TransactionType.WITHDRAW,
        reason,
        metadata,
        uniqueId,
        status: isCompleted ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && uniqueId) {
        this.logger.debug(`幂等兜底：uniqueId=${uniqueId} 触发唯一键冲突，视为成功`)
        return
      }
      throw error
    }
  }

  /**
   * 将冻结金额正式划转到系统提现钱包（从冻结余额扣减）
   * 幂等：若 uniqueId 对应交易已存在则不重复执行
   */
  async finalizeWithdrawFromHold(
    walletId: string,
    assetTypeId: string,
    amount: string | number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<string | undefined> {
    const resolvedAssetTypeId = await this.resolveAssetTypeId(assetTypeId)

    await this.ensureBothAssets(walletId, SystemWalletID.SYSTEM_WITHDRAW, resolvedAssetTypeId)

    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        return existed.id
      }
    }

    const amountStr = this.normalizePositiveAmount(resolvedAssetTypeId, amount)

    await this.walletRepository.transferBalance(
      walletId,
      SystemWalletID.SYSTEM_WITHDRAW,
      resolvedAssetTypeId,
      amountStr,
      true,
      false,
    )

    try {
      await this.walletRepository.createTransaction({
        fromWalletId: walletId,
        toWalletId: SystemWalletID.SYSTEM_WITHDRAW,
        assetTypeId: resolvedAssetTypeId,
        amount: amountStr,
        type: TransactionType.WITHDRAW,
        reason,
        metadata,
        uniqueId,
        status: TransactionStatus.COMPLETED,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && uniqueId) {
        this.logger.debug(`幂等兜底：uniqueId=${uniqueId} 触发唯一键冲突，视为成功`)
        const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
        return existed?.id
      }
      throw error
    }

    if (uniqueId) {
      const tx = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      return tx?.id
    }

    return undefined
  }

  /**
   * 将系统提现钱包中的金额退回到用户钱包（用于渠道失败补偿）
   */
  async refundFromSystemWithdraw(
    walletId: string,
    assetTypeId: string,
    amount: string | number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        this.logger.debug(`幂等命中：uniqueId=${uniqueId}，跳过操作`)
        return
      }
    }

    const resolvedAssetTypeId = await this.resolveAssetTypeId(assetTypeId)

    await this.ensureBothAssets(SystemWalletID.SYSTEM_WITHDRAW, walletId, resolvedAssetTypeId)

    const amountStr = this.normalizePositiveAmount(resolvedAssetTypeId, amount)

    await this.walletRepository.transferBalance(
      SystemWalletID.SYSTEM_WITHDRAW,
      walletId,
      resolvedAssetTypeId,
      amountStr,
      false,
      false,
    )

    try {
      await this.walletRepository.createTransaction({
        fromWalletId: SystemWalletID.SYSTEM_WITHDRAW,
        toWalletId: walletId,
        assetTypeId: resolvedAssetTypeId,
        amount: amountStr,
        type: TransactionType.REFUND,
        reason,
        metadata,
        uniqueId,
        status: TransactionStatus.COMPLETED,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && uniqueId) {
        this.logger.debug(`幂等兜底：uniqueId=${uniqueId} 触发唯一键冲突，视为成功`)
        return
      }
      throw error
    }
  }

  async deposit(
    walletId: string,
    assetTypeId: string,
    amount: string | number,
    isCompleted: boolean,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        this.logger.debug(`幂等命中：uniqueId=${uniqueId}，跳过操作`)
        return
      }
    }

    const resolvedAssetTypeId = await this.resolveAssetTypeId(assetTypeId)

    await this.ensureBothAssets(SystemWalletID.SYSTEM_DEPOSIT, walletId, resolvedAssetTypeId)

    const amountStr = this.normalizePositiveAmount(resolvedAssetTypeId, amount)

    await this.walletRepository.transferBalance(
      SystemWalletID.SYSTEM_DEPOSIT,
      walletId,
      resolvedAssetTypeId,
      amountStr,
      false,
      false,
    )

    try {
      await this.walletRepository.createTransaction({
        fromWalletId: SystemWalletID.SYSTEM_DEPOSIT,
        toWalletId: walletId,
        assetTypeId: resolvedAssetTypeId,
        amount: amountStr,
        status: isCompleted ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        type: TransactionType.RECHARGE,
        reason,
        metadata,
        uniqueId,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && uniqueId) {
        this.logger.debug(`幂等兜底：uniqueId=${uniqueId} 触发唯一键冲突，视为成功`)
        return
      }
      throw error
    }
  }

  async transferCommission(
    toWalletId: string,
    amount: number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    // 幂等前置查询
    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        this.logger.debug(`幂等命中：uniqueId=${uniqueId}，跳过操作`)
        return
      }
    }
    await this.transferAsset({
      fromWalletId: SystemWalletID.SYSTEM_COMMISSION,
      toWalletId,
      assetTypeId: AssetCode.DIAMOND, // 分佣只支持钻石
      amount: this.normalizePositiveAmount(AssetCode.DIAMOND, amount),
      type: TransactionType.COMMISSION,
      reason,
      metadata,
      uniqueId,
    })
  }

  /**
   * 处理用户消费，将指定金额从用户钱包转入系统费用钱包
   * @param userId 用户ID
   * @param assetTypeId 资产类型ID，默认为 SCORE
   * @param amount 消费金额
   * @param reason 消费原因
   * @param metadata 额外元数据
   * @param uniqueId 交易唯一ID
   */
  async consume(
    userId: string,
    assetTypeId: string = AssetCode.SCORE,
    amount: number | string,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<void> {
    // 查找用户的钱包
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      throw new DomainException(`Wallet not found for user ${userId}`, {
        code: ErrorCode.WALLET_NOT_FOUND,
        args: { userId },
        status: HttpStatus.NOT_FOUND,
      })
    }

    // 统一金额精度至 6 位小数
    const normalizedAmount = this.normalizePositiveAmount(assetTypeId, amount)
    // 幂等前置查询
    if (uniqueId) {
      const existed = await this.walletRepository.findTransactionByUniqueId(uniqueId)
      if (existed) {
        this.logger.debug(`幂等命中：uniqueId=${uniqueId}，跳过操作`)
        return
      }
    }
    await this.transferAsset({
      fromWalletId: wallet.id,
      toWalletId: SystemWalletID.SYSTEM_AI_REVENUE,
      assetTypeId,
      amount: normalizedAmount,
      type: TransactionType.CONSUMPTION,
      reason: reason || '用户消费',
      metadata,
      uniqueId,
    })
  }

  /**
   * 测试嵌套事务 - 此方法内部调用了其他带有 @Transaction 的方法
   * 用于验证事务传播是否正确工作
   */
  async testNestedTransaction(
    userId: string,
    fromAsset: string,
    toAsset: string,
    amount: number,
  ): Promise<void> {
    this.logger.log(`开始测试嵌套事务 - 用户: ${userId}, 金额: ${amount}`)

    // 解析用户对应的钱包ID
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      throw new DomainException(`Wallet not found for user ${userId}`, {
        code: ErrorCode.WALLET_NOT_FOUND,
        args: { userId },
        status: HttpStatus.NOT_FOUND,
      })
    }

    // 调用第一个带 @Transaction 的方法（使用钱包ID）
    await this.deposit(wallet.id, fromAsset, amount, true, '测试存款')
    this.logger.log(`存款完成 - 用户: ${userId}, 资产: ${fromAsset}, 金额: ${amount}`)

    // 调用第二个带 @Transaction 的方法（使用钱包ID）
    await this.transferAsset({
      fromWalletId: wallet.id,
      toWalletId: SystemWalletID.SYSTEM_AI_REVENUE,
      assetTypeId: toAsset,
      amount: this.normalizePositiveAmount(toAsset, new Decimal(amount).div(2).toString()),
      type: TransactionType.TIP,
      reason: '测试转账',
    })
    this.logger.log(`转账完成 - 从用户: ${userId} 到系统, 资产: ${toAsset}, 金额: ${amount / 2}`)

    // 故意引发错误以测试全部回滚
    if (amount > 100) {
      this.logger.warn(`金额 ${amount} 过大，测试回滚`)
      throw new DomainException('Test transaction rollback - amount too large', {
        code: ErrorCode.WALLET_TEST_ROLLBACK,
        args: { amount },
      })
    }

    this.logger.log(`嵌套事务测试完成`)
  }

  /**
   * 专门用于E2E测试的冻结方法，确保在单个事务中执行
   * @param walletId 钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 冻结金额
   * @param reason 原因
   * @param metadata 元数据
   * @param uniqueId 唯一标识
   * @returns 操作结果
   */
  async testFrozenAsset(
    walletId: string,
    assetTypeId: string,
    amount: number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(
        `测试专用冻结方法 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}, 金额: ${amount}`,
      )

      // 使用仓库方法执行冻结操作
      const result = await this.walletRepository.testFreezeAsset(
        walletId,
        assetTypeId,
        normalizeAmountByAsset(assetTypeId, amount),
        uniqueId,
        reason,
        metadata,
      )

      if (result.beforeAsset && result.afterAsset) {
        this.logger.debug(
          `冻结前余额 - 可用: ${result.beforeAsset.balance}, 冻结: ${result.beforeAsset.frozenBalance}`,
        )
        this.logger.debug(
          `冻结后余额 - 可用: ${result.afterAsset.balance}, 冻结: ${result.afterAsset.frozenBalance}`,
        )
      }

      return {
        success: result.success,
        message: result.message,
      }
    } catch (error) {
      this.logger.error(`测试冻结失败 - ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  /**
   * 专门用于E2E测试的解冻方法，确保在单个事务中执行
   * @param walletId 钱包ID
   * @param assetTypeId 资产类型ID
   * @param amount 解冻金额
   * @param reason 原因
   * @param metadata 元数据
   * @param uniqueId 唯一标识
   * @returns 操作结果
   */
  async testUnfrozenAsset(
    walletId: string,
    assetTypeId: string,
    amount: number,
    reason?: string,
    metadata?: any,
    uniqueId?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(
        `测试专用解冻方法 - 钱包ID: ${walletId}, 资产类型ID: ${assetTypeId}, 金额: ${amount}`,
      )

      // 使用仓库方法执行解冻操作
      const result = await this.walletRepository.testUnfreezeAsset(
        walletId,
        assetTypeId,
        normalizeAmountByAsset(assetTypeId, amount),
        uniqueId,
        reason,
        metadata,
      )

      if (result.beforeAsset && result.afterAsset) {
        this.logger.debug(
          `解冻前余额 - 可用: ${result.beforeAsset.balance}, 冻结: ${result.beforeAsset.frozenBalance}`,
        )
        this.logger.debug(
          `解冻后余额 - 可用: ${result.afterAsset.balance}, 冻结: ${result.afterAsset.frozenBalance}`,
        )
      }

      return {
        success: result.success,
        message: result.message,
      }
    } catch (error) {
      this.logger.error(`测试解冻失败 - ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  private toAmountString(value: Decimal.Value, precision = 6): string {
    const decimal = value instanceof Decimal ? value : new Decimal(value as any)
    return normalizeToFixed(decimal.toString(), precision)
  }

  private toAssetAmountString(assetCode: string, value: Decimal.Value): string {
    const decimal = value instanceof Decimal ? value : new Decimal(value as any)
    return normalizeAmountByAsset(assetCode, decimal.toString())
  }
}
