import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { CreateAdminUserDto, ResetAdminPasswordDto, UpdateAdminUserDto, AdminUserResponseDto } from '../dto/admin-user.dto'
import { AdminUserService } from '../services/admin-user.service'

@Controller('admin/users')
@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: '管理员列表' })
  @ApiOkResponse({ type: AdminUserResponseDto, isArray: true })
  list(): Promise<AdminUserResponseDto[]> {
    return this.adminUserService.list()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建管理员' })
  @ApiCreatedResponse({ type: AdminUserResponseDto })
  create(@Body() dto: CreateAdminUserDto): Promise<AdminUserResponseDto> {
    return this.adminUserService.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新管理员' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateAdminUserDto): Promise<AdminUserResponseDto> {
    return this.adminUserService.update(id, dto)
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置管理员密码' })
  @ApiOkResponse({ description: '密码已重置' })
  resetPassword(@Param('id') id: string, @Body() dto: ResetAdminPasswordDto) {
    return this.adminUserService.resetPassword(id, dto)
  }
}
