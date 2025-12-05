import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { UserService } from './user.service'
import {
  AdminCreateUserDto,
  AdminManagedUserDto,
  AdminResetUserPasswordDto,
  AdminUpdateUserDto,
  AdminUserListQueryDto,
  AdminUserListResponseDto,
} from './dto/admin.user.dto'

@Controller('admin/members')
@ApiTags('admin-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UserAdminController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '分页查询前台用户' })
  @ApiOkResponse({ type: AdminUserListResponseDto })
  list(@Query() query: AdminUserListQueryDto): Promise<AdminUserListResponseDto> {
    return this.userService.adminListUsers(query)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取前台用户详情' })
  @ApiOkResponse({ type: AdminManagedUserDto })
  detail(@Param('id') id: string): Promise<AdminManagedUserDto> {
    return this.userService.adminFindUserById(id)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建前台用户' })
  @ApiCreatedResponse({ type: AdminManagedUserDto })
  create(@Body() dto: AdminCreateUserDto): Promise<AdminManagedUserDto> {
    return this.userService.adminCreateUser(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新前台用户' })
  @ApiOkResponse({ type: AdminManagedUserDto })
  update(@Param('id') id: string, @Body() dto: AdminUpdateUserDto): Promise<AdminManagedUserDto> {
    return this.userService.adminUpdateUser(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '冻结并软删除前台用户（标记为 suspended 且设置 deletedAt）' })
  @ApiNoContentResponse({ description: '操作成功' })
  remove(@Param('id') id: string): Promise<void> {
    return this.userService.adminDeleteUser(id)
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置前台用户密码' })
  @ApiOkResponse({ description: '密码已重置' })
  resetPassword(@Param('id') id: string, @Body() dto: AdminResetUserPasswordDto): Promise<void> {
    return this.userService.adminResetUserPassword(id, dto)
  }
}
