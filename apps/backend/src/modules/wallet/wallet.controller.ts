import {
  Controller,
  Get,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DomainException } from '@/common/exceptions/domain.exception';
import { ErrorCode } from '@ai/shared';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { WalletDetailResponseDto } from './dto/responses/wallet.detail.response.dto';
import { GetTransactionsRequestDto } from './dto/requests/get.transactions.request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { CurrentUser } from '../auth/decorators/current.user.decorator';
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前用户的钱包' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: WalletDetailResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '钱包不存在' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  async getMyWallet(@CurrentUser('id') userId: string): Promise<WalletDetailResponseDto> {
    return this.walletService.getWalletByUserId(userId);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前用户的交易记录' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    type: BasePaginationResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: '未授权' })
  async getTransactions(
    @Query() query: GetTransactionsRequestDto,
    @CurrentUser('id') userId: string,
  ) {
    const userWallet = await this.walletService.getWalletByUserId(userId);
    // 如果 没有传入fromWalletId 和 toWalletId 则默认使用用户的钱包
    if (!query.fromWalletId && !query.toWalletId) {
      query.toWalletId = userWallet.id;
      // query.toWalletId = userWallet.id;
    }

    if (!(query.fromWalletId === userWallet.id || query.toWalletId === userWallet.id)) {
      throw new DomainException('Permission denied to access these transactions.', {
        code: ErrorCode.FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    // 使用标准分页格式返回交易记录
    return this.walletService.getWalletTransactions(userWallet.id, {
      assetTypeId: query.assetTypeId,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });
  }
}
