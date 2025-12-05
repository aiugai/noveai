import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ValidationPipe,
  UseGuards,
  Header,
  Logger,
  Res,
  ParseEnumPipe,
  Query,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiConsumes,
  ApiProduces,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
  ApiQuery,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { Public } from '@/modules/auth/decorators/public.decorator'
import { PaymentService } from './services/payment.service'
import { CreatePaymentOrderRequestDto } from './dto/requests/create.payment.order.request.dto'
import { CreateExternalPaymentOrderDto } from './dto/requests/create-external-payment-order.dto'
import { QueryExternalOrderStatusDto } from './dto/requests/query-external-order-status.dto'
import { ExternalOrderStatusResponseDto } from './dto/responses/external-order-status.response.dto'
import { PaymentOrderResponseDto, ExternalOrderPublicResponseDto } from './dto/responses/payment.order.response.dto'
import { CurrentUser } from '@/modules/auth/decorators/current.user.decorator'
import { WGQPayCallbackDto } from './dto/requests/wgqpay.callback.request.dto'
import type { Response } from 'express'
import { PaymentChannel } from './enums/payment.channel.enum'
import { PaymentOptionsResponseDto } from './dto/responses/payment.options.response.dto'
import { SkipThrottle } from '@nestjs/throttler'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { Transaction } from '@/common/decorators/transaction.decorator'
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe'

@ApiTags('Payment')
@ApiExtraModels(BasePaginationResponseDto, PaymentOrderResponseDto)
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name)
  constructor(private readonly paymentService: PaymentService) {}

  @Get('options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询当前支持的支付方式和目标资产代码' })
  @ApiResponse({ status: 200, type: PaymentOptionsResponseDto })
  async getPaymentOptions(): Promise<PaymentOptionsResponseDto> {
    return this.paymentService.getPaymentOptions()
  }

  @Post('orders')
  @Transaction() // ✅ 添加事务边界，确保 afterCommit 行为一致（Issue #465）
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment order (for deposit)' })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
    type: PaymentOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPaymentOrder(
    @CurrentUser('id') userId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePaymentOrderRequestDto,
  ): Promise<PaymentOrderResponseDto> {
    return this.paymentService.createPaymentOrder(userId, dto)
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户的订单记录（分页）' })
  @ApiOkResponse({
    description: '分页订单列表',
    schema: {
      allOf: [{ $ref: getSchemaPath(BasePaginationResponseDto) }],
      properties: {
        items: {
          type: 'array',
          items: { $ref: getSchemaPath(PaymentOrderResponseDto) },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: '页码（从1开始）' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: '每页数量（1-100）',
  })
  async getMyOrders(
    @CurrentUser('id') userId: string,
    @Query() query: BasePaginationRequestDto,
  ): Promise<BasePaginationResponseDto<PaymentOrderResponseDto>> {
    return this.paymentService.getMyOrders(userId, query)
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取指定订单详情' })
  @ApiParam({
    name: 'id',
    description: '订单 ID (CUID 格式)',
    example: 'c1a2b3c4d5e6f7g8h9i0j1k2',
  })
  @ApiResponse({
    status: 200,
    description: '订单详情',
    type: PaymentOrderResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 404, description: '订单不存在或无权访问' })
  async getOrderById(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseCuidPipe()) orderId: string,
  ): Promise<PaymentOrderResponseDto> {
    return this.paymentService.getPaymentOrderById(orderId, userId)
  }

  /**
   * 创建外部商户支付订单
   *
   * @description
   * 外部商户模式：用户在 /recharge 页面选择商品后创建订单
   * - 使用 HMAC-SHA256 签名验证（无需 JWT）
   * - 时间戳防重放（± 5 分钟）
   * - 幂等性：相同 merchantId + businessOrderId 返回相同订单
   */
  @Post('external/orders')
  @Transaction()
  @Public() // 无需 JWT 认证，使用签名验证
  @ApiOperation({
    summary: '创建外部商户支付订单',
    description: '外部商户模式下创建支付订单，使用签名验证身份',
  })
  @ApiResponse({
    status: 201,
    description: '订单创建成功（精简版，不含敏感信息）',
    type: ExternalOrderPublicResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误或时间戳过期' })
  @ApiResponse({ status: 403, description: '签名验证失败或商户已禁用' })
  @ApiResponse({ status: 404, description: '商户不存在' })
  @ApiResponse({ status: 409, description: '订单号重复' })
  async createExternalPaymentOrder(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateExternalPaymentOrderDto,
  ): Promise<ExternalOrderPublicResponseDto> {
    return this.paymentService.createExternalPaymentOrderPublic(dto)
  }

  /**
   * 查询外部订单状态
   *
   * @description
   * 外部商户查询订单状态
   * - 使用 HMAC-SHA256 签名验证（无需 JWT）
   * - 返回订单状态和商品信息
   */
  @Get('external/order-status')
  @Public() // 无需 JWT 认证，使用签名验证
  @ApiOperation({
    summary: '查询外部订单状态',
    description: '外部商户查询订单状态，使用签名验证身份',
  })
  @ApiOkResponse({
    description: '订单状态',
    type: ExternalOrderStatusResponseDto,
  })
  @ApiResponse({ status: 400, description: '请求参数错误或时间戳过期' })
  @ApiResponse({ status: 403, description: '签名验证失败或商户已禁用' })
  @ApiResponse({ status: 404, description: '商户不存在或订单不存在' })
  async queryExternalOrderStatus(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    dto: QueryExternalOrderStatusDto,
  ): Promise<ExternalOrderStatusResponseDto> {
    return this.paymentService.queryExternalOrderStatus(dto)
  }

  /**
   * 获取支付选项（公开接口）
   *
   * @description
   * 供外部商户模式使用，无需登录
   * - 返回可用的支付方式、资产类型、套餐列表
   */
  @Get('external/options')
  @Public()
  @ApiOperation({
    summary: '获取支付选项（公开）',
    description: '外部商户模式获取支付选项，无需登录',
  })
  @ApiResponse({ status: 200, type: PaymentOptionsResponseDto })
  async getExternalPaymentOptions(): Promise<PaymentOptionsResponseDto> {
    return this.paymentService.getPaymentOptions()
  }

  /**
   * 查询外部订单详情（公开接口）
   *
   * @description
   * 供外部商户模式前端轮询订单状态使用
   * - 仅允许查询外部商户创建的订单
   * - 通过订单 ID 直接查询，无需签名
   * - 返回精简 DTO，不包含敏感商户信息（callbackUrl、merchantContext 等）
   */
  @Get('external/orders/:id')
  @Public()
  @ApiOperation({
    summary: '查询外部订单详情（公开）',
    description: '外部商户模式查询订单详情，仅限外部订单。返回精简信息，不包含敏感商户数据。',
  })
  @ApiParam({
    name: 'id',
    description: '订单 ID (CUID 格式)',
    example: 'c1a2b3c4d5e6f7g8h9i0j1k2',
  })
  @ApiResponse({
    status: 200,
    description: '订单详情（精简版，不含敏感信息）',
    type: ExternalOrderPublicResponseDto,
  })
  @ApiResponse({ status: 404, description: '订单不存在或非外部订单' })
  async getExternalOrderById(
    @Param('id', new ParseCuidPipe()) orderId: string,
  ): Promise<ExternalOrderPublicResponseDto> {
    return this.paymentService.getExternalOrderByIdPublic(orderId)
  }

  // Callback endpoints are typically open but secured differently (e.g., signature verification)
  // These should NOT use JWT guard
  @Post('callback/:channel')
  @Transaction() // ✅ 确保 processSuccessfulPayment 的 afterCommit 在事务提交后执行（Issue #465）
  @Public()
  @SkipThrottle()
  // 统一使用全局限流，不再设置端点级限流
  @ApiOperation({
    summary: 'Handle payment provider callback (Webhook)',
    description: 'Internal endpoint for receiving payment status updates.',
  })
  @ApiResponse({ status: 200, description: 'Callback received' })
  @ApiResponse({
    status: 400,
    description: 'Unknown channel or invalid payload',
    schema: { example: 'FAIL' },
  })
  @ApiParam({ name: 'channel', enum: Object.values(PaymentChannel), description: '回调渠道' })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiBody({ description: 'WGQPay 回调负载', type: WGQPayCallbackDto })
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  @ApiProduces('text/plain')
  async handleCallback(
    @Param('channel', new ParseEnumPipe(PaymentChannel)) channel: PaymentChannel,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    payload: WGQPayCallbackDto,
    @Body() rawPayload: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string | void> {
    this.logger.log(`Received callback for channel: ${channel}`)
    // It's crucial that the service method handles errors gracefully and doesn't throw
    // back to the provider, otherwise the provider might keep retrying.
    const mergedPayload = this.paymentService.prepareCallbackPayload(
      channel,
      payload,
      (rawPayload ?? {}) as Record<string, unknown>,
    )
    const mergedRecord = mergedPayload as Record<string, unknown>
    const merchantOrderId = String(mergedRecord?.merchant_order_id ?? 'unknown')
    this.logger.debug(
      `Callback payload summary channel=${channel} merchantOrderId=${merchantOrderId} state=${mergedRecord?.state} code=${mergedRecord?.code} amount=${mergedRecord?.amount} payAmount=${mergedRecord?.pay_amount}`,
    )
    const result = await this.paymentService.handlePaymentCallback(channel, mergedPayload)
    if (channel === PaymentChannel.WGQPAY) {
      const shouldAck = result?.shouldAck !== false
      if (!shouldAck) {
        this.logger.warn(
          `WGQPay callback marked as NOT acked channel=${channel} merchantOrderId=${merchantOrderId} reason=${result?.reason} context=${result?.context ? JSON.stringify(result.context) : undefined}`,
        )
        res.type('text/plain; charset=utf-8')
        res.status(400)
        return 'FAIL'
      }
      if (!result?.ok) {
        this.logger.warn(
          `WGQPay callback acked with business failure channel=${channel} merchantOrderId=${merchantOrderId} reason=${result?.reason}`,
        )
      }
      if (result?.context) {
        this.logger.debug(
          `WGQPay callback context channel=${channel} merchantOrderId=${merchantOrderId} context=${JSON.stringify(result.context)}`,
        )
      }
      res.type('text/plain; charset=utf-8')
      res.status(200)
      return 'SUCCESS'
    }
    // 未知渠道：显式返回 400 与文本体，避免 Express 默认响应
    res.type('text/plain; charset=utf-8')
    res.status(400)
    return 'FAIL'
  }
}
