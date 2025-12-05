import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { PaymentOrder, PaymentOrderSourceType, PaymentOrderStatus, Prisma } from '@prisma/client'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'

interface AdminPaymentOrderListOptions {
  userId?: string
  status?: PaymentOrderStatus
  channel?: string
  externalOrderId?: string
  merchantId?: string
  businessOrderId?: string
  sourceType?: PaymentOrderSourceType
  createdFrom?: Date
  createdTo?: Date
  page?: number
  limit?: number
}

@Injectable()
export class PaymentOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async create(data: Prisma.PaymentOrderCreateInput): Promise<PaymentOrder> {
    const client = this.getClient()
    return client.paymentOrder.create({ data })
  }

  async findById(id: string): Promise<PaymentOrder | null> {
    const client = this.getClient()
    return client.paymentOrder.findUnique({ where: { id } })
  }

  async findByExternalOrderId(externalOrderId: string): Promise<PaymentOrder | null> {
    // Use findFirst for non-id unique fields if findUnique causes type issues
    const client = this.getClient()
    return client.paymentOrder.findFirst({
      where: { externalOrderId },
    })
  }

  /**
   * 根据商户 ID 和业务订单号查找订单（用于幂等性检查）
   */
  async findByMerchantOrder(merchantId: string, businessOrderId: string): Promise<PaymentOrder | null> {
    const client = this.getClient()
    return client.paymentOrder.findFirst({
      where: { merchantId, businessOrderId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async update(id: string, data: Prisma.PaymentOrderUpdateInput): Promise<PaymentOrder> {
    const client = this.getClient()
    return client.paymentOrder.update({ where: { id }, data })
  }

  // Add other methods as needed (e.g., findByUserId, findPending)

  async findByUserPaginated(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ total: number; items: PaymentOrder[] }> {
    const client = this.getClient()
    const where: Prisma.PaymentOrderWhereInput = { userId }
    const [total, items] = await Promise.all([
      client.paymentOrder.count({ where }),
      client.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return { total, items }
  }

  async findAllPaginated(
    options: AdminPaymentOrderListOptions = {},
  ): Promise<{ total: number; items: PaymentOrder[] }> {
    const safePage = Math.max(1, Number(options.page) || 1)
    const safeLimit = Math.min(
      PAGINATION_CONSTANTS.MAX_PAGE_SIZE,
      Math.max(1, Number(options.limit) || PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE),
    )

    const where: Prisma.PaymentOrderWhereInput = {}
    if (options.userId) {
      where.userId = options.userId
    }
    if (options.status) {
      where.status = options.status
    }
    if (options.channel) {
      where.channel = options.channel
    }
    if (options.externalOrderId) {
      where.externalOrderId = options.externalOrderId
    }
    if (options.merchantId) {
      where.merchantId = options.merchantId
    }
    if (options.businessOrderId) {
      where.businessOrderId = options.businessOrderId
    }
    if (options.sourceType) {
      where.sourceType = options.sourceType
    }
    if (options.createdFrom || options.createdTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {}
      if (options.createdFrom) {
        createdAtFilter.gte = options.createdFrom
      }
      if (options.createdTo) {
        createdAtFilter.lte = options.createdTo
      }
      where.createdAt = createdAtFilter
    }

    const client = this.getClient()
    const [total, items] = await Promise.all([
      client.paymentOrder.count({ where }),
      client.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ])
    return { total, items }
  }
}
