import { Injectable } from '@nestjs/common'
import { Prisma, PaymentRechargePackage, RechargePackageStatus } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class RechargePackageRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async findActiveOrdered(): Promise<PaymentRechargePackage[]> {
    return this.getClient().paymentRechargePackage.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async findById(id: string): Promise<PaymentRechargePackage | null> {
    return this.getClient().paymentRechargePackage.findUnique({ where: { id } })
  }

  async findByPrice(amount: string, currency: string): Promise<PaymentRechargePackage | null> {
    return this.getClient().paymentRechargePackage.findFirst({
      where: {
        priceAmount: new Prisma.Decimal(amount),
        priceCurrency: currency.toUpperCase(),
        status: 'ACTIVE',
      },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async create(data: Prisma.PaymentRechargePackageCreateInput): Promise<PaymentRechargePackage> {
    return this.getClient().paymentRechargePackage.create({ data })
  }

  async update(
    id: string,
    data: Prisma.PaymentRechargePackageUpdateInput,
  ): Promise<PaymentRechargePackage> {
    return this.getClient().paymentRechargePackage.update({ where: { id }, data })
  }

  async findAll(options?: {
    status?: RechargePackageStatus
    skip?: number
    take?: number
  }): Promise<{ items: PaymentRechargePackage[]; total: number }> {
    const where: Prisma.PaymentRechargePackageWhereInput = options?.status
      ? { status: options.status }
      : {}
    const client = this.getClient()
    const [items, total] = await Promise.all([
      client.paymentRechargePackage.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip: options?.skip,
        take: options?.take,
      }),
      client.paymentRechargePackage.count({ where }),
    ])
    return { items, total }
  }
}

