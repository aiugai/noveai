/**
 * 应用资源枚举 - 用于 RBAC 权限控制
 */
export enum AppResource {
  // 系统设置
  SETTINGS = 'settings',

  // 管理员用户
  ADMIN_USER = 'admin_user',

  // 角色管理
  ROLE = 'role',

  // 菜单管理
  MENU = 'menu',

  // 用户管理
  USER = 'user',

  // 钱包管理
  WALLET = 'wallet',

  // 系统钱包管理
  SYSTEM_WALLET = 'system-wallet',

  // 支付订单管理
  PAYMENT = 'payment',
}

/**
 * 操作类型枚举
 */
export enum AppAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}
