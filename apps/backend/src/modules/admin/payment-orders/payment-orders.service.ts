import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { PaymentOrderStatus, Prisma } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { PaymentService } from '@/modules/payment/services/payment.service'
import { PaymentCallbackService } from '@/modules/payment/services/payment-callback.service'
import { CreatePaymentOrderRequestDto } from '@/modules/payment/dto/requests/create.payment.order.request.dto'
import { PaymentMethod } from '@/modules/payment/enums/payment.method.enum'
import { PaymentChannel } from '@/modules/payment/enums/payment.channel.enum'
import { RechargePackageService } from '@/modules/payment/services/recharge-package.service'
import { RechargePackageNotFoundException } from '@/modules/payment/exceptions/recharge-package-not-found.exception'
import { EnvService } from '@/common/services/env.service'

import { QueryPaymentOrdersRequestDto } from './dto/requests/query-payment-orders.request.dto'
import { PaymentOrderItemResponseDto } from './dto/responses/payment-order-item.response.dto'
import { PaymentOrderDetailResponseDto } from './dto/responses/payment-order-detail.response.dto'
import { SimulateRechargeRequestDto } from './dto/requests/simulate-recharge.request.dto'

@Injectable()
export class PaymentOrdersService {
  private readonly logger = new Logger(PaymentOrdersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly paymentCallbackService: PaymentCallbackService,
    private readonly rechargePackageService: RechargePackageService,
    private readonly envService: EnvService,
  ) {}

  async findOrders(
    query: QueryPaymentOrdersRequestDto,
  ): Promise<BasePaginationResponseDto<PaymentOrderItemResponseDto>> {
    const {
      page = 1,
      limit: rawLimit = PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE,
    } = query

    const limit = Math.min(rawLimit, PAGINATION_CONSTANTS.MAX_PAGE_SIZE)

    const where = this.buildWhere(query)

    // 当 sourceType 未指定或为 EXTERNAL 时需要 paymentDetails（用于提取回调状态）
    // 确保混合查询（含外部订单）时也能返回回调状态
    const needPaymentDetails = query.sourceType !== 'INTERNAL'

    const [items, total] = await Promise.all([
      this.prisma.getClient().paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          channel: true,
          status: true,
          externalOrderId: true,
          sourceType: true,
          merchantId: true,
          externalUserId: true,
          businessOrderId: true,
          description: true,
          paymentDetails: needPaymentDetails,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.getClient().paymentOrder.count({ where }),
    ])

    const dtoItems = items.map(item => new PaymentOrderItemResponseDto(item))
    return new BasePaginationResponseDto(total, page, limit, dtoItems)
  }

  async getOrderDetail(orderId: string): Promise<PaymentOrderDetailResponseDto> {
    const order = await this.prisma.getClient().paymentOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        channel: true,
        status: true,
        externalOrderId: true,
        sourceType: true,
        merchantId: true,
        externalUserId: true,
        businessOrderId: true,
        description: true,
        targetAssetTypeId: true,
        targetAssetAmount: true,
        exchangeRate: true,
        paymentDetails: true,
        callbackData: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    })

    if (!order) {
      throw new DomainException('Order does not exist', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    return new PaymentOrderDetailResponseDto(order)
  }

  async simulateRecharge(dto: SimulateRechargeRequestDto): Promise<PaymentOrderDetailResponseDto> {
    const appEnv = this.envService.getAppEnv()
    this.logger.log(
      `Simulating recharge for user=${dto.userId} package=${dto.packageId} env=${appEnv}`,
    )

    if (appEnv === 'production') {
      throw new DomainException('Simulated recharge is disabled in production environment.', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    const packageEntity = await this.rechargePackageService.findById(dto.packageId)
    if (!packageEntity || packageEntity.status !== 'ACTIVE') {
      throw new RechargePackageNotFoundException({ packageId: dto.packageId })
    }

    const requestPayload: CreatePaymentOrderRequestDto = {
      amount: packageEntity.priceAmount.toFixed(2),
      currency: packageEntity.priceCurrency,
      method: dto.method ?? PaymentMethod.WECHAT,
      packageId: packageEntity.id,
      targetAssetCode: dto.targetAssetCode ?? 'SCORE',
    }

    const order = await this.paymentService.createPaymentOrder(dto.userId, requestPayload, {
      forcedChannel: PaymentChannel.MOCK,
    })

    if (order.status !== PaymentOrderStatus.COMPLETED) {
      if (!order.externalOrderId) {
        throw new DomainException('模拟充值失败：缺少 externalOrderId。', {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        })
      }

      const success = dto.success ?? true
      await this.paymentService.handlePaymentCallback(PaymentChannel.MOCK, {
        externalOrderId: order.externalOrderId,
        success,
      })
    }

    this.logger.log(
      `Simulated recharge completed for user=${dto.userId} package=${dto.packageId} orderId=${order.id} status=${order.status}`,
    )

    return this.getOrderDetail(order.id)
  }

  /**
   * 对已存在的 PENDING 订单模拟支付成功回调
   * 用于测试环境验证支付→钱包→商户回调全链路
   */
  async simulateCallback(orderId: string): Promise<PaymentOrderDetailResponseDto> {
    const appEnv = this.envService.getAppEnv()
    this.logger.log(`Simulating callback for order=${orderId} env=${appEnv}`)

    if (appEnv === 'production') {
      throw new DomainException('Simulated callback is disabled in production environment.', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    const order = await this.prisma.getClient().paymentOrder.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      throw new DomainException('Order does not exist', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    if (order.status !== PaymentOrderStatus.PENDING) {
      throw new DomainException(
        `Order is already in terminal status: ${order.status}. Only PENDING orders can be simulated.`,
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: { currentStatus: order.status },
        },
      )
    }

    // 构造模拟回调负载
    // 显式传递 orderId 以支持 externalOrderId 为空的场景（如 WGQPAY 渠道）
    const callbackPayload = {
      orderId: order.id,
      externalOrderId: order.externalOrderId ?? order.id,
      success: true,
      // 提供金额信息以通过校验
      amount: order.amount.toString(),
      currency: order.currency,
    }

    const result = await this.paymentService.handlePaymentCallback(
      PaymentChannel.MOCK,
      callbackPayload,
    )

    this.logger.log(
      `Simulated callback completed for order=${orderId} result=${JSON.stringify(result)}`,
    )

    if (!result.ok && result.reason !== 'IDEMPOTENT') {
      throw new DomainException(`Simulated callback failed: ${result.reason}`, {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: result.reason, context: result.context },
      })
    }

    return this.getOrderDetail(orderId)
  }

  /**
   * 手动重试商户回调通知
   * 仅对外部订单且回调失败状态有效
   */
  async retryCallback(orderId: string): Promise<PaymentOrderDetailResponseDto> {
    this.logger.log(`Manual callback retry for order=${orderId}`)

    const order = await this.prisma.getClient().paymentOrder.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      throw new DomainException('Order does not exist', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    // 校验：必须是外部订单
    if (order.sourceType !== 'EXTERNAL' || !order.merchantId || !order.callbackUrl) {
      throw new DomainException('Only external orders with callback URL can retry callback', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    // 校验：订单必须已完成（只有支付成功的订单才需要回调商户）
    if (order.status !== PaymentOrderStatus.COMPLETED) {
      throw new DomainException('Only completed orders can retry callback', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { currentStatus: order.status },
      })
    }

    // 校验：回调状态必须是失败
    const callbackInfo = this.paymentCallbackService.buildCallbackInfo(order)
    if (callbackInfo.callbackStatus === 'SUCCESS') {
      throw new DomainException('Callback already succeeded, no need to retry', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    // 执行回调
    const success = await this.paymentCallbackService.sendPaymentSuccessCallback(order)

    this.logger.log(`Manual callback retry completed for order=${orderId} success=${success}`)

    if (!success) {
      throw new DomainException(
        'Callback request failed, task has been queued for automatic retry',
        {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: { orderId },
        },
      )
    }

    return this.getOrderDetail(orderId)
  }

  private buildWhere(
    query: QueryPaymentOrdersRequestDto,
  ): Prisma.PaymentOrderWhereInput {
    const { userId, channel, status, sourceType, startTime, endTime } = query

    return {
      ...(userId && { userId }),
      ...(channel && { channel }),
      ...(status && { status }),
      ...(sourceType && { sourceType }),
      ...((startTime || endTime) && {
        createdAt: {
          ...(startTime && { gte: new Date(startTime) }),
          ...(endTime && { lte: new Date(endTime) }),
        },
      }),
    }
  }
}

