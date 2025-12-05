import { Injectable, Logger } from '@nestjs/common'

/**
 * 审计日志类型枚举
 */
export enum AuditLogType {
  // 系统钱包相关
  SYSTEM_WALLET_ADJUSTED = 'SYSTEM_WALLET_ADJUSTED',
  SYSTEM_WALLET_SNAPSHOT_CREATED = 'SYSTEM_WALLET_SNAPSHOT_CREATED',

  // 用户相关
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',

  // 管理员相关
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

export interface CreateAuditLogParams {
  type: AuditLogType
  operatorId: string
  targetId?: string
  targetType?: string
  metadata?: Record<string, any>
}

/**
 * 审计日志服务
 * 用于记录系统关键操作的审计日志
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  /**
   * 创建审计日志
   * 当前实现仅记录到日志，后续可扩展为数据库存储
   */
  async createLog(params: CreateAuditLogParams): Promise<void> {
    this.logger.log(`[AUDIT] ${params.type}`, {
      operatorId: params.operatorId,
      targetId: params.targetId,
      targetType: params.targetType,
      metadata: params.metadata,
      timestamp: new Date().toISOString(),
    })
  }
}
