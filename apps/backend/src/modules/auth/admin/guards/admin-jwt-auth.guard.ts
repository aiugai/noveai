import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { ADMIN_RESOURCE_KEY, ADMIN_ACTION_KEY } from '../decorators/access.decorator'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 先验证 JWT
    const isAuthenticated = await super.canActivate(context)
    if (!isAuthenticated) {
      return false
    }

    const request = context.switchToHttp().getRequest()
    const admin = request.user

    if (!admin) {
      throw new DomainException('Not logged in or session expired', { code: ErrorCode.AUTH_UNAUTHORIZED })
    }

    // 获取资源和操作
    const resource = this.reflector.getAllAndOverride<string>(ADMIN_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const action = this.reflector.getAllAndOverride<string>(ADMIN_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // 如果没有定义资源权限要求，只要登录即可
    if (!resource || !action) {
      return true
    }

    // TODO: 实现细粒度权限检查
    // 当前简化版：只要是管理员就放行
    // 后续可扩展：根据 admin.roles 检查是否有 resource:action 权限
    return true
  }
}
