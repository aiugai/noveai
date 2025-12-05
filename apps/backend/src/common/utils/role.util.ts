/**
 * 角色工具函数
 * 提供统一的角色判定逻辑，避免权限失真
 */

/**
 * 判断角色代码是否为超级管理员
 *
 * 统一兼容以下变体（不区分大小写）：
 * - super_admin
 * - super-admin
 * - superadmin
 *
 * 注意：不包含普通的 'admin' 角色，以避免权限边界扩大
 *
 * @param roleCode 角色代码
 * @returns 是否为超级管理员
 *
 * @example
 * isSuperAdmin('super_admin') // true
 * isSuperAdmin('Super-Admin') // true
 * isSuperAdmin('superadmin') // true
 * isSuperAdmin('admin') // false - 普通管理员不是超级管理员
 * isSuperAdmin('normal_user') // false
 */
export function isSuperAdmin(roleCode: string | null | undefined): boolean {
  if (!roleCode) {
    return false
  }

  const normalized = roleCode.toLowerCase().trim()
  // 只识别 super_admin 的同义词，不包含普通 admin
  return normalized === 'super_admin' || normalized === 'super-admin' || normalized === 'superadmin'
}

/**
 * 检查角色列表中是否包含超级管理员
 *
 * @param roles 角色列表（角色代码数组或角色对象数组）
 * @returns 是否包含超级管理员
 *
 * @example
 * hasSuperAdmin(['user', 'super_admin']) // true
 * hasSuperAdmin([{ code: 'super-admin' }, { code: 'user' }]) // true
 * hasSuperAdmin([{ code: 'admin' }]) // false - 普通管理员不是超级管理员
 * hasSuperAdmin([{ code: 'normal_user' }]) // false
 */
export function hasSuperAdmin(
  roles: string[] | Array<{ code: string }> | null | undefined,
): boolean {
  if (!roles || roles.length === 0) {
    return false
  }

  // 处理字符串数组
  if (typeof roles[0] === 'string') {
    return (roles as string[]).some(code => isSuperAdmin(code))
  }

  // 处理对象数组
  return (roles as Array<{ code: string }>).some(role => isSuperAdmin(role.code))
}
