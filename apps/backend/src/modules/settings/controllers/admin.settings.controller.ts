import { Controller, Get, Post, Put, Patch, Body, Param, Query, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { SettingsService } from '../services/settings.service'
import { CreateSettingDto } from '../dto/requests/create-setting.dto'
import { UpdateSettingDto } from '../dto/requests/update-setting.dto'
import { SettingResponseDto } from '../dto/responses/setting.response.dto'
import {
  AdminReadAny,
  AdminUpdateAny,
  AdminCreateAny,
} from '@/modules/auth/admin/decorators/access.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { maskSettingValue } from '../utils/mask.util'

@ApiTags('admin')
@Controller('admin/settings')
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有配置' })
  @ApiResponse({ status: 200, type: [SettingResponseDto] })
  @AdminReadAny(AppResource.SETTINGS)
  async getAllSettings(@Query('category') category?: string): Promise<SettingResponseDto[]> {
    const settings = category
      ? await this.settingsService.getSettingsByCategory(category)
      : await this.settingsService.getAllSettings()
    // 对敏感字段进行脱敏
    return settings.map(
      setting =>
        new SettingResponseDto({
          ...setting,
          value: maskSettingValue(setting.key, setting.type, setting.value),
        }),
    )
  }

  @Post()
  @ApiOperation({ summary: '创建配置' })
  @ApiResponse({ status: 201, type: SettingResponseDto })
  @AdminCreateAny(AppResource.SETTINGS)
  async createSetting(@Body() dto: CreateSettingDto): Promise<SettingResponseDto> {
    const setting = await this.settingsService.set(dto.key, dto.value, {
      type: dto.type,
      description: dto.description,
      category: dto.category,
      isSystem: dto.isSystem,
    })
    return new SettingResponseDto({
      ...setting,
      value: maskSettingValue(setting.key, setting.type, setting.value),
    })
  }

  @Put(':key')
  @ApiOperation({ summary: '更新配置' })
  @ApiResponse({ status: 200, type: SettingResponseDto })
  @AdminUpdateAny(AppResource.SETTINGS)
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ): Promise<SettingResponseDto> {
    const setting = await this.settingsService.set(key, dto.value, {
      type: dto.type,
      description: dto.description,
      category: dto.category,
      isSystem: dto.isSystem,
    })
    return new SettingResponseDto({
      ...setting,
      value: maskSettingValue(setting.key, setting.type, setting.value),
    })
  }

  @Patch()
  @ApiOperation({ summary: '重新加载所有配置' })
  @ApiResponse({ status: 200 })
  @AdminUpdateAny(AppResource.SETTINGS)
  @HttpCode(200)
  async reloadSettings(): Promise<{ success: boolean }> {
    await this.settingsService.loadAllSettings()
    return { success: true }
  }
}
