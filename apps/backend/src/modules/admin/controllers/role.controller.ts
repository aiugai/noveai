import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { CreateRoleDto, UpdateRoleDto, AdminRoleResponseDto } from '../dto/role.dto'
import { RoleService } from '../services/role.service'

@Controller('admin/roles')
@ApiTags('admin-roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: '角色列表' })
  @ApiOkResponse({ type: AdminRoleResponseDto, isArray: true })
  list(): Promise<AdminRoleResponseDto[]> {
    return this.roleService.list()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建角色' })
  @ApiCreatedResponse({ type: AdminRoleResponseDto })
  create(@Body() dto: CreateRoleDto): Promise<AdminRoleResponseDto> {
    return this.roleService.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新角色' })
  @ApiOkResponse({ type: AdminRoleResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<AdminRoleResponseDto> {
    return this.roleService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除角色' })
  @ApiOkResponse({ description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.roleService.remove(id)
  }
}
