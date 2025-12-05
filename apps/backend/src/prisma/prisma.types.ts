import { Prisma } from '@prisma/client'

// 直接导出所有Prisma模型和枚举
export * from '@prisma/client'

// 用户等级枚举 (不在数据库中存储为枚举)
export enum UserLevel {
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
  EXPERT = 4,
  MASTER = 5,
}

// 认证提供商枚举 (不在数据库中存储为枚举)
export enum AuthProvider {
  GOOGLE = 'google',
  TWITTER = 'twitter',
  GITHUB = 'github',
  DISCORD = 'discord',
  LOCAL = 'local',
}

// 场景兼容性等级枚举 (不在数据库中存储为枚举)
export enum SceneCompatibilityLevel {
  INCOMPATIBLE = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  PERFECT = 5,
}

// 导出 Prisma 类型供其他模块使用
export type { Prisma }
