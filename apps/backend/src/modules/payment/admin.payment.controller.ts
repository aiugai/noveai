import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import {
  AdminCreateAny,
  AdminReadAny,
  AdminUpdateAny,
} from '@/modules/auth/admin/decorators/access.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { PaymentOrderRepository } from './repositories/payment.order.repository'
import { PaymentOrderResponseDto } from './dto/responses/payment.order.response.dto'
import { AdminListPaymentOrdersRequestDto } from './dto/requests/admin.list.payment.orders.request.dto'
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { AdminQueryRechargePackagesDto } from './dto/requests/admin.query.recharge-package.dto'
import { RechargePackageResponseDto } from './dto/responses/recharge-package.response.dto'
import { RechargePackageService } from './services/recharge-package.service'
import { AdminCreateRechargePackageDto } from './dto/requests/admin.create.recharge-package.dto'
import { AdminUpdateRechargePackageDto } from './dto/requests/admin.update.recharge-package.dto'
import { CallbackInfoResponseDto } from './dto/responses/callback-info.response.dto'
import { PaymentCallbackService } from './services/payment-callback.service'

@ApiTags('admin')
@ApiBearerAuth()
@ApiExtraModels(BasePaginationResponseDto, PaymentOrderResponseDto, RechargePackageResponseDto, CallbackInfoResponseDto)
@Controller('admin/payments')
export class AdminPaymentController {
  constructor(
    private readonly paymentOrderRepository: PaymentOrderRepository,
    private readonly rechargePackageService: RechargePackageService,
    private readonly callbackService: PaymentCallbackService,
  ) {}

  @Get('orders')
  @AdminReadAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '分页查询支付订单' })
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
  async listOrders(
    @Query() query: AdminListPaymentOrdersRequestDto,
  ): Promise<BasePaginationResponseDto<PaymentOrderResponseDto>> {
    const { page, limit, ...filters } = query
    const { total, items } = await this.paymentOrderRepository.findAllPaginated({
      ...filters,
      page,
      limit,
    })
    const dtos = items.map(order => new PaymentOrderResponseDto(order))
    return new BasePaginationResponseDto(total, page, limit, dtos)
  }

  @Get('orders/:id')
  @AdminReadAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '获取支付订单详情' })
  @ApiOkResponse({ description: '订单详情', type: PaymentOrderResponseDto })
  async getOrderById(
    @Param('id', new ParseCuidPipe()) id: string,
  ): Promise<PaymentOrderResponseDto> {
    const order = await this.paymentOrderRepository.findById(id)
    if (!order) {
      throw new DomainException(`Payment order '${id}' not found`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    return new PaymentOrderResponseDto(order)
  }

  @Get('recharge-packages')
  @AdminReadAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '分页查询充值套餐' })
  @ApiOkResponse({
    description: '分页套餐列表',
    schema: {
      allOf: [{ $ref: getSchemaPath(BasePaginationResponseDto) }],
      properties: {
        items: {
          type: 'array',
          items: { $ref: getSchemaPath(RechargePackageResponseDto) },
        },
      },
    },
  })
  async listRechargePackages(
    @Query() query: AdminQueryRechargePackagesDto,
  ): Promise<BasePaginationResponseDto<RechargePackageResponseDto>> {
    const { page, limit, status } = query
    const skip = (page - 1) * limit
    const { items, total } = await this.rechargePackageService.findAll({
      status,
      skip,
      take: limit,
    })
    const dtos = items.map(pkg => new RechargePackageResponseDto(pkg))
    return new BasePaginationResponseDto(total, page, limit, dtos)
  }

  @Get('recharge-packages/:id')
  @AdminReadAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '查看指定充值套餐' })
  @ApiOkResponse({ description: '套餐详情', type: RechargePackageResponseDto })
  async getRechargePackage(
    @Param('id', new ParseCuidPipe()) id: string,
  ): Promise<RechargePackageResponseDto> {
    const pkg = await this.rechargePackageService.findById(id)
    if (!pkg) {
      throw new DomainException(`Recharge package '${id}' not found`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    return new RechargePackageResponseDto(pkg)
  }

  @Post('recharge-packages')
  @AdminCreateAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '创建充值套餐' })
  @ApiResponse({ status: 201, description: '创建成功', type: RechargePackageResponseDto })
  async createRechargePackage(
    @Body() dto: AdminCreateRechargePackageDto,
  ): Promise<RechargePackageResponseDto> {
    const pkg = await this.rechargePackageService.createPackage(dto)
    return new RechargePackageResponseDto(pkg)
  }

  @Put('recharge-packages/:id')
  @AdminUpdateAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '更新充值套餐' })
  @ApiOkResponse({ description: '更新成功', type: RechargePackageResponseDto })
  async updateRechargePackage(
    @Param('id', new ParseCuidPipe()) id: string,
    @Body() dto: AdminUpdateRechargePackageDto,
  ): Promise<RechargePackageResponseDto> {
    const pkg = await this.rechargePackageService.updatePackage(id, dto)
    return new RechargePackageResponseDto(pkg)
  }

  // ==================== 回调管理 ====================

  @Get('orders/:id/callback')
  @AdminReadAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '获取订单回调信息' })
  @ApiOkResponse({ description: '回调信息', type: CallbackInfoResponseDto })
  async getCallbackInfo(
    @Param('id', new ParseCuidPipe()) id: string,
  ): Promise<CallbackInfoResponseDto> {
    const order = await this.paymentOrderRepository.findById(id)
    if (!order) {
      throw new DomainException(`Payment order '${id}' not found`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    if (!order.merchantId || !order.callbackUrl) {
      throw new DomainException(`Order '${id}' is not an external merchant order`, {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { id },
      })
    }
    // 使用 service 构建回调信息，DTO 仅做数据映射
    const callbackInfo = this.callbackService.buildCallbackInfo(order)
    return new CallbackInfoResponseDto(callbackInfo)
  }

  @Post('orders/:id/callback/retry')
  @AdminUpdateAny(AppResource.PAYMENT)
  @ApiOperation({ summary: '手动重试回调' })
  @ApiResponse({ status: 200, description: '重试已触发' })
  async retryCallback(
    @Param('id', new ParseCuidPipe()) id: string,
  ): Promise<{ success: boolean; message: string }> {
    const order = await this.paymentOrderRepository.findById(id)
    if (!order) {
      throw new DomainException(`Payment order '${id}' not found`, {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id },
      })
    }
    if (!order.merchantId || !order.callbackUrl) {
      throw new DomainException(`Order '${id}' is not an external merchant order`, {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { id },
      })
    }

    // 使用 service 方法检查回调状态
    if (this.callbackService.isCallbackCompleted(order)) {
      return { success: false, message: '回调已成功，无需重试' }
    }

    // 执行回调
    const success = await this.callbackService.sendPaymentSuccessCallback(order)
    return {
      success,
      message: success ? '回调成功' : '回调失败，已加入重试队列',
    }
  }
}
