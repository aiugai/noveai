import { Injectable, Logger } from '@nestjs/common'
import { PaymentRechargePackage, Prisma, RechargePackageStatus } from '@prisma/client'
import { CacheService } from '@/cache/cache.service'
import { RechargePackageRepository } from '../repositories/recharge-package.repository'

interface CreateRechargePackageInput {
  name: string
  displayTitle: string
  badgeLabel: string
  priceAmount: string
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  totalScore: number
  sortOrder: number
  metadata?: Record<string, unknown>
}

interface UpdateRechargePackageInput extends Partial<CreateRechargePackageInput> {
  status?: RechargePackageStatus
}

@Injectable()
export class RechargePackageService {
  private readonly logger = new Logger(RechargePackageService.name)
  private readonly cacheKey = 'payment:recharge-packages:active'
  private readonly cacheTtlSeconds = 60

  constructor(
    private readonly repository: RechargePackageRepository,
    private readonly cache: CacheService,
  ) {}

  async getActivePackages(): Promise<PaymentRechargePackage[]> {
    const cached = await this.cache.get<PaymentRechargePackage[]>(this.cacheKey)
    if (cached) return cached

    const packages = await this.repository.findActiveOrdered()
    if (packages.length > 0) {
      await this.cache.set(this.cacheKey, packages, this.cacheTtlSeconds)
    }
    return packages
  }

  async findById(id: string): Promise<PaymentRechargePackage | null> {
    return this.repository.findById(id)
  }

  async findByPrice(amount: string, currency: string): Promise<PaymentRechargePackage | null> {
    return this.repository.findByPrice(amount, currency)
  }

  async findAll(options?: {
    status?: RechargePackageStatus
    skip?: number
    take?: number
  }): Promise<{ items: PaymentRechargePackage[]; total: number }> {
    return this.repository.findAll(options)
  }

  async createPackage(input: CreateRechargePackageInput): Promise<PaymentRechargePackage> {
    const created = await this.repository.create({
      name: input.name,
      displayTitle: input.displayTitle,
      badgeLabel: input.badgeLabel,
      priceAmount: new Prisma.Decimal(input.priceAmount),
      priceCurrency: input.priceCurrency.toUpperCase(),
      baseScore: input.baseScore,
      bonusPercent: input.bonusPercent,
      totalScore: input.totalScore,
      sortOrder: input.sortOrder,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    })
    await this.clearCache()
    this.logger.log(`Created recharge package ${created.id} (${created.displayTitle})`)
    return created
  }

  async updatePackage(
    id: string,
    input: UpdateRechargePackageInput,
  ): Promise<PaymentRechargePackage> {
    const data: Prisma.PaymentRechargePackageUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.displayTitle !== undefined) data.displayTitle = input.displayTitle
    if (input.badgeLabel !== undefined) data.badgeLabel = input.badgeLabel
    if (input.priceAmount !== undefined) {
      data.priceAmount = new Prisma.Decimal(input.priceAmount)
    }
    if (input.priceCurrency !== undefined) {
      data.priceCurrency = input.priceCurrency.toUpperCase()
    }
    if (input.baseScore !== undefined) data.baseScore = input.baseScore
    if (input.bonusPercent !== undefined) data.bonusPercent = input.bonusPercent
    if (input.totalScore !== undefined) data.totalScore = input.totalScore
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
    if (input.metadata !== undefined) {
      data.metadata = (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined
    }
    if (input.status !== undefined) data.status = input.status

    const updated = await this.repository.update(id, data)
    await this.clearCache()
    this.logger.log(`Updated recharge package ${updated.id} (${updated.displayTitle})`)
    return updated
  }

  async clearCache(): Promise<void> {
    await this.cache.del(this.cacheKey)
    this.logger.debug('已清除充值套餐缓存')
  }
}

