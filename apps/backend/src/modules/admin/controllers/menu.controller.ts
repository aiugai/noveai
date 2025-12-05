import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { JwtAuthGuard } from '@/modules/auth/guards/jwt.auth.guard'
import { CreateMenuDto, UpdateMenuDto, AdminMenuResponseDto } from '../dto/menu.dto'
import { MenuService } from '../services/menu.service'

@Controller('admin/menus')
@ApiTags('admin-menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: '菜单列表' })
  @ApiOkResponse({ type: AdminMenuResponseDto, isArray: true })
  list(): Promise<AdminMenuResponseDto[]> {
    return this.menuService.list()
  }

  @Get('tree')
  @ApiOperation({ summary: '菜单树' })
  @ApiExcludeEndpoint()
  tree(): Promise<AdminMenuResponseDto[]> {
    return this.menuService.tree()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建菜单' })
  @ApiCreatedResponse({ type: AdminMenuResponseDto })
  create(@Body() dto: CreateMenuDto): Promise<AdminMenuResponseDto> {
    return this.menuService.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新菜单' })
  @ApiOkResponse({ type: AdminMenuResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto): Promise<AdminMenuResponseDto> {
    return this.menuService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除菜单' })
  @ApiOkResponse({ description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.menuService.remove(id)
  }
}
