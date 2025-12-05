import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { AdminCreateAny, AdminReadAny } from '@/modules/auth/admin/decorators/access.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'

import { PaymentOrdersService } from './payment-orders.service'
import { QueryPaymentOrdersRequestDto } from './dto/requests/query-payment-orders.request.dto'
import { PaymentOrderItemResponseDto } from './dto/responses/payment-order-item.response.dto'
import { PaymentOrderDetailResponseDto } from './dto/responses/payment-order-detail.response.dto'
import { SimulateRechargeRequestDto } from './dto/requests/simulate-recharge.request.dto'

@Controller('admin/payment/orders')
@ApiTags('admin-payment-orders')
@ApiExtraModels(BasePaginationResponseDto, PaymentOrderItemResponseDto, PaymentOrderDetailResponseDto)
@ApiBearerAuth()
export class PaymentOrdersController {
  constructor(private readonly paymentOrdersService: PaymentOrdersService) {}

  @Get()
  @ApiOperation({ summary: '获取充值订单列表' })
  @ApiOkResponse({
    description: '订单列表',
    schema: {
      allOf: [{ $ref: getSchemaPath(BasePaginationResponseDto) }],
      properties: {
        items: {
          type: 'array',
          items: { $ref: getSchemaPath(PaymentOrderItemResponseDto) },
        },
      },
    },
  })
  @AdminReadAny(AppResource.PAYMENT)
  async getOrders(@Query() query: QueryPaymentOrdersRequestDto) {
    return this.paymentOrdersService.findOrders(query)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiOkResponse({
    type: PaymentOrderDetailResponseDto,
    description: '订单详情',
  })
  @AdminReadAny(AppResource.PAYMENT)
  async getOrderDetail(@Param('id') id: string) {
    return this.paymentOrdersService.getOrderDetail(id)
  }

  @Post('simulate-recharge')
  @ApiOperation({ summary: '模拟用户充值（仅非生产环境）' })
  @ApiOkResponse({
    type: PaymentOrderDetailResponseDto,
    description: '模拟充值结果',
  })
  @AdminCreateAny(AppResource.PAYMENT)
  async simulateRecharge(@Body() dto: SimulateRechargeRequestDto) {
    return this.paymentOrdersService.simulateRecharge(dto)
  }

  @Post(':id/simulate-callback')
  @ApiOperation({ summary: '模拟已有订单支付成功回调（仅非生产环境）' })
  @ApiOkResponse({
    type: PaymentOrderDetailResponseDto,
    description: '模拟回调后的订单详情',
  })
  @AdminCreateAny(AppResource.PAYMENT)
  async simulateCallback(@Param('id') orderId: string) {
    return this.paymentOrdersService.simulateCallback(orderId)
  }

  @Post(':id/retry-callback')
  @ApiOperation({ summary: '手动重试商户回调通知（仅外部订单）' })
  @ApiOkResponse({
    type: PaymentOrderDetailResponseDto,
    description: '重试后的订单详情',
  })
  @AdminCreateAny(AppResource.PAYMENT)
  async retryCallback(@Param('id') orderId: string) {
    return this.paymentOrdersService.retryCallback(orderId)
  }
}

