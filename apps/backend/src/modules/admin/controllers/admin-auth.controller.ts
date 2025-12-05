import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Public } from '@/modules/auth/decorators/public.decorator'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { CurrentUser } from '@/modules/auth/decorators/current.user.decorator'
import { AdminAuthService } from '../services/admin-auth.service'
import { AdminAuthResponseDto, AdminLoginDto, AdminProfileDto, AdminRegisterDto, ChangeAdminPasswordDto } from '../dto/admin-auth.dto'

@Controller('admin/auth')
@ApiTags('admin-auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '管理员注册' })
  @ApiOkResponse({ type: AdminAuthResponseDto })
  register(@Body() dto: AdminRegisterDto): Promise<AdminAuthResponseDto> {
    return this.adminAuthService.register(dto)
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '管理员登录' })
  @ApiOkResponse({ type: AdminAuthResponseDto })
  login(@Body() dto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    return this.adminAuthService.login(dto)
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前管理员' })
  @ApiOkResponse({ type: AdminProfileDto })
  me(@CurrentUser('id') adminId: string): Promise<AdminProfileDto> {
    return this.adminAuthService.profile(adminId)
  }

  @Post('password/change')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改当前管理员密码' })
  @ApiOkResponse({ description: '密码修改成功' })
  changePassword(
    @CurrentUser('id') adminId: string,
    @Body() dto: ChangeAdminPasswordDto,
  ): Promise<void> {
    return this.adminAuthService.changePassword(adminId, dto)
  }
}
