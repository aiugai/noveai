import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ApiBearerAuth } from '@nestjs/swagger'
import { AppResource, AppAction } from '../../rbac/permissions'
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard'

export const ADMIN_RESOURCE_KEY = 'admin_resource'
export const ADMIN_ACTION_KEY = 'admin_action'

/**
 * 管理员权限装饰器 - 读取任意资源
 */
export function AdminReadAny(resource: AppResource) {
  return applyDecorators(
    SetMetadata(ADMIN_RESOURCE_KEY, resource),
    SetMetadata(ADMIN_ACTION_KEY, AppAction.READ),
    UseGuards(AdminJwtAuthGuard),
    ApiBearerAuth(),
  )
}

/**
 * 管理员权限装饰器 - 创建任意资源
 */
export function AdminCreateAny(resource: AppResource) {
  return applyDecorators(
    SetMetadata(ADMIN_RESOURCE_KEY, resource),
    SetMetadata(ADMIN_ACTION_KEY, AppAction.CREATE),
    UseGuards(AdminJwtAuthGuard),
    ApiBearerAuth(),
  )
}

/**
 * 管理员权限装饰器 - 更新任意资源
 */
export function AdminUpdateAny(resource: AppResource) {
  return applyDecorators(
    SetMetadata(ADMIN_RESOURCE_KEY, resource),
    SetMetadata(ADMIN_ACTION_KEY, AppAction.UPDATE),
    UseGuards(AdminJwtAuthGuard),
    ApiBearerAuth(),
  )
}

/**
 * 管理员权限装饰器 - 删除任意资源
 */
export function AdminDeleteAny(resource: AppResource) {
  return applyDecorators(
    SetMetadata(ADMIN_RESOURCE_KEY, resource),
    SetMetadata(ADMIN_ACTION_KEY, AppAction.DELETE),
    UseGuards(AdminJwtAuthGuard),
    ApiBearerAuth(),
  )
}
