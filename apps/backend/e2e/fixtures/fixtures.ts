import { INestApplication, BadRequestException, ValidationPipe } from '@nestjs/common'
import { TestingModule, Test } from '@nestjs/testing'
import { AuthResponseDto } from '../../src/modules/auth/dto/responses/auth.response.dto'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { SchedulerRegistry } from '@nestjs/schedule'
import { WinstonModule } from 'nest-winston'
import * as winston from 'winston'
import { AppModule } from '../../src/app.module'
import { TransactionInterceptor } from '@/common/interceptors/transaction.interceptor'
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  aiConfig,
} from '../../src/config/configuration'
import { AuthModule } from '../../src/modules/auth/auth.module'
import { isTestEnvironment, isDevOrTestEnvironment, getTestLogLevel } from './e2e-env'

import { UserService as NormalUserService } from '../../src/modules/user/user.service'
import { UserProfileResponseDto } from '@/modules/user/dto/responses/user.profile.response.dto'
import { AdminUserService } from '../../src/modules/admin/services/admin-user.service'
import { PrismaService } from '../../src/prisma/prisma.service'
/* eslint-disable ts/no-require-imports */
// 使用 require 以兼容 ts-jest 下的 CJS 超测导出
const request: any = (require('supertest') as any).default || require('supertest')

/**
 * API前缀常量
 */
export const API_PREFIX = 'api/v1'

export interface TestAppContext {
  app: INestApplication
  moduleFixture: TestingModule
  prisma: PrismaService
}

export interface BootstrapE2eAppOptions {
  /**
   * 是否按接近生产的方式启动（启用更多全局拦截器/日志）
   */
  productionLike?: boolean
  /**
   * createTestingApp 透传 imports，用于按需替换 AppModule
   */
  imports?: any[]
}

/**
 * 构建完整API URL
 * @param endpoint API端点路径
 * @returns 添加了API前缀的完整URL
 */
export function buildApiUrl(endpoint: string): string {
  // 如果为空直接返回API前缀
  if (!endpoint) {
    return `/${API_PREFIX}`
  }

  // 移除开头的斜杠以便统一处理
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint

  // 检查是否已经包含API前缀
  if (cleanEndpoint.startsWith(`${API_PREFIX}/`) || cleanEndpoint === API_PREFIX) {
    return `/${cleanEndpoint}`
  }

  // 检查是否已经是完整的API路径但没有API_PREFIX前导部分
  const apiPattern = /^api\/v\d+\//
  if (apiPattern.test(cleanEndpoint)) {
    return `/${cleanEndpoint}`
  }

  // 添加API前缀
  return `/${API_PREFIX}/${cleanEndpoint}`
}

/**
 * Create testing application
 * @param imports modules to import
 * @returns testing app and module
 */
export async function createTestingApp(
  imports: any[] = [AppModule],
): Promise<{ app: INestApplication; moduleFixture: TestingModule }> {
  // Ensure using test environment configuration
  if (!isTestEnvironment()) {
    // Warning: Test not running in test environment, may affect production database
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports,
  }).compile()

  const app = moduleFixture.createNestApplication()
  // const _configService = moduleFixture.get<ConfigService>(ConfigService)

  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.setGlobalPrefix(API_PREFIX)

  // Use test port
  // const testPort = configService.get<number>('app.port') || 3001;
  await app.init()

  // 确保基础角色已存在
  const prismaService = moduleFixture.get<PrismaService>(PrismaService)
  await setupTestRoles(prismaService)

  //

  return { app, moduleFixture }
}

/**
 * Generate test JWT token
 * @param userId user ID
 * @param jwtService JWT service
 * @param level User level (1=普通用户, 2=版主)
 * @returns JWT token
 */
export function generateTestJwtToken(
  userId: string,
  jwtService: JwtService,
  level: number = 1,
): string {
  const payload: any = {
    sub: userId,
    nickname: `test-user-${userId}`,
    level,
  }

  return jwtService.sign(payload)
}

/**
 * Create test module with configuration
 * @returns test module
 */
export async function createConfigTestingModule() {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        load: [appConfig, databaseConfig, jwtConfig, redisConfig, aiConfig],
        isGlobal: true,
      }),
      AuthModule,
    ],
    providers: [ConfigService],
  }).compile()
}

/**
 * Clean up test data
 * @param prisma Prisma service
 */
export async function cleanupTestData(prisma: PrismaService) {
  try {
    // Safety check: ensure only cleaning data in test database
    if (!isDevOrTestEnvironment()) {
      return
    }

    // 使用更轻量级的删除策略，避免 TRUNCATE CASCADE 导致的连接池耗尽
    // 按照依赖关系顺序删除数据，避免外键约束冲突
    const deleteOperations = [
      // 第一层：没有外键依赖的表或最末端的表
      prisma.message.deleteMany(),
      prisma.sharedStory.deleteMany(),
      prisma.userActivityProgress.deleteMany(),
      // 先删关系再删邀请码，避免外键报错
      prisma.invitationRelationship.deleteMany(),
      prisma.invitationCode.deleteMany(),
      prisma.worldInfo.deleteMany(),
      prisma.preset.deleteMany(),
      prisma.chatDebugPrompt.deleteMany(),
      prisma.chatDebugStep.deleteMany(),
      prisma.chatDebugSession.deleteMany(),
      prisma.fileRecord.deleteMany(),
      prisma.verificationCode.deleteMany(),
      prisma.inviteRewardUnlockLog.deleteMany(),
      prisma.inviteRewardGrant.deleteMany(),
      prisma.inviteRewardUnlockConfig.deleteMany(),
      prisma.walletTransaction.deleteMany(),
      // 佣金相关（依赖 user），需在删除 user 之前清理
      prisma.commissionRecord.deleteMany(),
      prisma.commissionRate.deleteMany(),
      prisma.commissionStatistics.deleteMany(),

      // AI用例相关表 - 需要先删除依赖表
      prisma.aiUsecaseLog.deleteMany(),
      prisma.aiUsecase.deleteMany(),

      // 第二层：依赖于第一层的表
      prisma.story.deleteMany(),
      prisma.character.deleteMany(),
      prisma.virtualModel.deleteMany(),
      prisma.wallet.deleteMany(),
      prisma.walletAsset.deleteMany(),

      // 支付相关表 - 依赖于user
      prisma.paymentOrder.deleteMany(),
      prisma.paymentRechargePackage.deleteMany(),

      // 第三层：核心用户相关表
      prisma.adminUserRole.deleteMany(),
      prisma.adminUser.deleteMany(),
      prisma.adminRole.deleteMany(),
      prisma.userMembership.deleteMany(),
      prisma.user.deleteMany(),

      // 第四层：系统级表
      prisma.model.deleteMany(),
      prisma.systemSetting.deleteMany(),
      prisma.activityDefinition.deleteMany(),
    ]

    // 使用批量操作，但不使用事务，避免长时间锁定
    for (const operation of deleteOperations) {
      try {
        await operation
      } catch (_error) {
        // 忽略单个删除失败，继续处理下一个
      }
    }
  } catch (error) {
    console.error('清理测试数据失败:', error)
  }
}

/**
 * 在邮箱验证表内创建一条有效验证码（集中造数）
 */
export async function seedVerificationCode(
  prisma: PrismaService,
  email: string,
  code: string,
  purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' = 'EMAIL_VERIFICATION',
  ttlMs = 10 * 60 * 1000,
) {
  const expiresAt = new Date(Date.now() + ttlMs)
  await prisma.verificationCode.create({
    data: { email, code, purpose: purpose as any, expiresAt },
  })
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

/**
 * 创建一个自动附加 Authorization 头的请求帮助器（仅在提供 token 时附加）
 */
export function createAuthorizedRequest(app: INestApplication, token?: string) {
  const server = app.getHttpServer()
  const buildRequest = (method: HttpMethod) => (url: string) => {
    const httpRequest = request(server)[method](buildApiUrl(url))
    if (token) {
      httpRequest.set('Authorization', `Bearer ${token}`)
    }
    return httpRequest
  }

  return {
    get: buildRequest('get'),
    post: buildRequest('post'),
    put: buildRequest('put'),
    delete: buildRequest('delete'),
    patch: buildRequest('patch'),
  }
}

/**
 * 兼容旧逻辑的用户请求助手
 */
export function createAuthRequest(app: INestApplication, token?: string) {
  return createAuthorizedRequest(app, token)
}

/**
 * 兼容旧逻辑的管理员请求助手
 */
export function createAdminAuthRequest(app: INestApplication, token?: string) {
  return createAuthorizedRequest(app, token)
}

/**
 * 确保测试所需的配置已经存在
 * @param prisma Prisma服务
 */
export async function setupTestRoles(prisma: PrismaService): Promise<void> {
  // 角色系统已重构为基于level字段的权限系统
  // level 1 = 普通用户, level 2 = 版主
  // 无需创建角色，直接返回

  // 创建 points 资产类型用于E2E测试
  const assetTypeModel = (prisma as Record<string, any>)?.assetType
  if (!assetTypeModel?.upsert) {
    // 精简脚手架中可能没有该表，直接跳过
    return
  }
  await assetTypeModel.upsert({
    where: { code: 'points' },
    update: {},
    create: {
      code: 'points',
      name: '积分',
      isActive: true,
    },
  })
}

export interface TestUserAuthResponse extends AuthResponseDto {
  credentials: {
    email: string
    password: string
  }
}

/**
 * Create test user
 * @param app NestJS application instance
 * @param prefix test user prefix
 * @returns created user and auth info
 */
export async function createTestUser(
  app: INestApplication,
  prefix: string = 'test',
): Promise<TestUserAuthResponse> {
  // 获取必要的服务
  const userService = app.get(NormalUserService)
  const jwtService = app.get(JwtService)
  const prismaService = app.get(PrismaService)

  // 生成测试用户数据
  const password = Math.random().toString(36).slice(-10)
  const email = `${prefix}_${generateRandomString(8)}@example.com`

  // 调用UserService创建用户
  const createdUser = await userService.createUser({
    email,
    password,
    // Roles are connected internally by userService.createUser
  })

  // 创建邮箱凭据（模拟注册流程）
  await prismaService.userCredential.create({
    data: {
      userId: createdUser.id,
      type: 'email',
      value: email.toLowerCase(),
      secret: null, // 邮箱类型不存储密码
    },
  })

  const profile: UserProfileResponseDto = {
    id: createdUser.id,
    email: createdUser.email,
    nickname: createdUser.nickname ?? undefined,
    emailVerified: createdUser.emailVerified,
    createdAt: createdUser.createdAt,
  }

  const token = generateTestJwtToken(createdUser.id, jwtService)

  const authResponse: TestUserAuthResponse = {
    accessToken: token,
    user: profile,
    credentials: {
      email,
      password,
    },
  }

  return authResponse
}

/**
 * Generate random string
 * @param length length
 * @returns random string
 */
export function generateRandomString(length: number = 10): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

/**
 * 创建完整的测试模块配置，尽可能模拟生产环境
 * 与main.ts中的配置保持一致
 * @returns 完整配置的测试模块和应用实例
 */
export async function createProductionLikeTestingApp() {
  // 确保使用测试环境配置
  if (!isTestEnvironment()) {
    // 警告: 测试未在测试环境中运行，可能会影响生产数据库
  }

  // 创建Winston日志配置
  const testLogLevel = getTestLogLevel()
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        level: testLogLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.colorize(),
          winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
        ),
      }),
    ],
  })

  // 使用AppModule确保导入所有模块
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleFixture.createNestApplication({ logger })
  const configService = app.get<ConfigService>(ConfigService)
  const prismaService = app.get(PrismaService)

  // 使用与生产环境一致的管道，但允许测试环境的灵活性
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // 在测试环境中禁用以避免DTO验证问题
      enableDebugMessages: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: errors => {
        const errorMessages = errors.map(err => ({
          property: err.property,
          constraints: err.constraints,
          value: err.value,
        }))
        // 输出详细的校验错误，便于定位 400 来源
        try {
          // 避免循环引用导致的报错
          console.error('[E2E ValidationErrors]', JSON.stringify(errorMessages))
        } catch {}
        return new BadRequestException(errorMessages)
      },
    }),
  )

  // 使用与生产环境一致的拦截器 - 移除LoggerInterceptor，测试环境不需要详细HTTP日志
  app.useGlobalInterceptors(new TransactionInterceptor(prismaService))

  // 设置全局API前缀
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1')
  app.setGlobalPrefix(apiPrefix)

  // 启用CORS
  app.enableCors()

  // 初始化应用
  await app.init()

  // 确保 Prisma 表存在
  await ensurePrismaTablesExist(prismaService)

  // 运行模型种子，确保默认模型（如 DeepSeek-V3）在测试数据库中可用
  try {
    const { seedModels } = await import('../../prisma/seed/model-seed')
    await seedModels()
    //
  } catch (_seedErr) {}

  // 确保基础角色已存在
  await setupTestRoles(prismaService)

  return { app, moduleFixture }
}

/**
 * 统一的 E2E 启动封装，便于测试套件重用
 */
export async function bootstrapE2eApp(
  options: BootstrapE2eAppOptions = {},
): Promise<TestAppContext> {
  const { productionLike = false, imports } = options
  const { app, moduleFixture } = productionLike
    ? await createProductionLikeTestingApp()
    : await createTestingApp(imports)

  const prisma = moduleFixture.get<PrismaService>(PrismaService)
  disableScheduledJobs(app)

  return { app, moduleFixture, prisma }
}

function disableScheduledJobs(app: INestApplication) {
  try {
    const scheduler = app.get(SchedulerRegistry, { strict: false })
    if (!scheduler) {
      return
    }
    try {
      scheduler.getCronJobs().forEach(job => {
        if (typeof job?.stop === 'function') {
          job.stop()
        }
      })
    } catch {}
    try {
      const intervals = scheduler.getIntervals?.() ?? []
      for (const name of intervals) {
        try {
          scheduler.deleteInterval(name)
        } catch {}
      }
    } catch {}
    try {
      const timeouts = scheduler.getTimeouts?.() ?? []
      for (const name of timeouts) {
        try {
          scheduler.deleteTimeout(name)
        } catch {}
      }
    } catch {}
  } catch {}
}

/**
 * 测试buildApiUrl函数的功能
 * 此函数仅用于开发阶段验证，测试完成后可移除
 */
export function testBuildApiUrl(): void {
  const testCases = [
    { input: 'users/me', expected: '/api/v1/users/me' },
    { input: '/users/me', expected: '/api/v1/users/me' },
    { input: 'api/v1/users/me', expected: '/api/v1/users/me' },
    { input: '/api/v1/users/me', expected: '/api/v1/users/me' },
    {
      input: 'users/followers?page=1&limit=10',
      expected: '/api/v1/users/followers?page=1&limit=10',
    },
    { input: '', expected: '/api/v1' },
    { input: 'api/v2/users', expected: '/api/v2/users' }, // 其他API版本
  ]

  testCases.forEach(({ input, expected }) => {
    const result = buildApiUrl(input)
    if (result !== expected) {
      console.warn('[testBuildApiUrl] mismatch', { input, expected, result })
    }
  })
}

/**
 * Create admin test user
 * @param app NestJS application instance
 * @returns admin user and auth info
 */
export async function createAdminUser(app: INestApplication): Promise<AuthResponseDto> {
  // 获取必要的服务
  const jwtService = app.get(JwtService)
  const prismaService = app.get(PrismaService)
  const adminUserService = app.get(AdminUserService)

  // 生成管理员用户数据
  const password = Math.random().toString(36).slice(-10)
  const username = `admin_${generateRandomString(8)}`
  const email = `${username}@example.com`

  // 先确保有默认的管理员角色
  const adminRole = await prismaService.adminRole.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      code: 'admin',
      name: '管理员',
      menuPermissions: ['read:*', 'create:*', 'update:*', 'delete:*'],
      featurePermissions: ['read:*', 'create:*', 'update:*', 'delete:*'],
      apiPermissions: [
        'read:*',
        'create:*',
        'update:*',
        'delete:*',
        'read:activities',
        'create:activities',
        'update:activities',
        'delete:activities',
        'read:invite',
        'create:invite',
        'update:invite',
        'delete:invite',
      ],
    },
  })

  // 首选通过 userService.create 创建（会自动联动普通用户），如果因权限等问题失败则回退到直接写数据库
  let adminUser
  try {
    adminUser = await adminUserService.create(
      {
        username,
        password,
        nickName: username,
        email,
        roles: [adminRole.id],
      } as any,
      null,
      { bypassPermissionCheck: true },
    )
  } catch (_error) {
    // userService.create 失败，回退到直接写数据库
    const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash(password, 10))
    adminUser = await prismaService.adminUser.create({
      data: {
        username,
        password: hashedPassword,
        email,
        nickName: username,
        isFrozen: false,
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    // 补充：手动插入 users 表，避免外键冲突
    await prismaService.user.upsert({
      where: { id: adminUser.id },
      update: {},
      create: {
        id: adminUser.id,
        email: adminUser.email,
        password: hashedPassword,
        nickname: adminUser.nickName,
      },
    })
  }

  // 生成JWT令牌
  const token = jwtService.sign({
    sub: adminUser.id,
    username: adminUser.username,
    roles: adminUser.roles.map(r => r.role.code),
  })

  // 模拟用户资料响应
  const profile = {
    id: adminUser.id,
    email: adminUser.email,
    nickname: adminUser.nickName || adminUser.username,
    avatarUrl: adminUser.headPic || '',
    bio: '',
    level: 2, // 管理员级别
    gender: 'prefer_not_to_say' as const,
    birthday: '',
    location: '',
    createdAt: adminUser.createTime.toISOString(),
    lastActiveAt: adminUser.updateTime.toISOString(),
    roles: adminUser.roles.map(r => ({ id: r.role.id, name: r.role.name })),
    emailVerified: true, // 管理员邮箱默认已验证
    oauthBindings: adminUser.oauthBindings,
  }

  // 格式化响应以匹配AuthResponseDto
  const authResponse: AuthResponseDto = {
    profile,
    token: {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600,
    },
  }

  return authResponse
}

/**
 * 创建SuperAdmin用户并获取JWT令牌（用于测试）
 * @param app NestJS 应用实例
 * @returns 包含用户资料和令牌的响应
 */
export async function createSuperAdminUser(app: INestApplication): Promise<AuthResponseDto> {
  // 获取必要的服务
  const jwtService = app.get(JwtService)
  const prismaService = app.get(PrismaService)
  const adminUserService = app.get(AdminUserService)

  // 生成SuperAdmin用户数据
  const password = Math.random().toString(36).slice(-10)
  const username = `superadmin_${generateRandomString(8)}`
  const email = `${username}@example.com`

  // 先确保有SuperAdmin角色
  const superAdminRole = await prismaService.adminRole.upsert({
    where: { code: 'super_admin' },
    update: {},
    create: {
      code: 'super_admin',
      name: '超级管理员',
      menuPermissions: ['manage:*'],
      featurePermissions: ['manage:*'],
      apiPermissions: ['manage:*'],
    },
  })

  // 创建SuperAdmin用户
  let superAdminUser: any
  try {
    superAdminUser = await adminUserService.create({
      username,
      password,
      nickName: username,
      email,
      roles: [superAdminRole.id],
    } as any)
  } catch (_error) {
    // 回退到直接写数据库
    const hashedPassword = await import('bcrypt').then(bcrypt => bcrypt.hash(password, 10))
    superAdminUser = await prismaService.adminUser.create({
      data: {
        username,
        password: hashedPassword,
        email,
        nickName: username,
        isFrozen: false,
        roles: {
          create: {
            roleId: superAdminRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    // 补充：手动插入 users 表
    await prismaService.user.upsert({
      where: { id: superAdminUser.id },
      update: {},
      create: {
        id: superAdminUser.id,
        email: superAdminUser.email,
        password: hashedPassword,
        nickname: superAdminUser.nickName,
      },
    })
  }

  // 生成JWT令牌
  const token = jwtService.sign({
    sub: superAdminUser.id,
    username: superAdminUser.username,
    roles: superAdminUser.roles.map((r: any) => r.role.code),
  })

  // 模拟用户资料响应
  const profile = {
    id: superAdminUser.id,
    email: superAdminUser.email,
    nickname: superAdminUser.nickName || superAdminUser.username,
    avatarUrl: superAdminUser.headPic || '',
    bio: '',
    level: 2, // 管理员级别
    gender: 'prefer_not_to_say' as const,
    birthday: '',
    location: '',
    createdAt: superAdminUser.createTime.toISOString(),
    lastActiveAt: superAdminUser.updateTime.toISOString(),
    roles: superAdminUser.roles.map((r: any) => ({ id: r.role.id, name: r.role.name })),
    emailVerified: true,
    oauthBindings: superAdminUser.oauthBindings,
  }

  // 格式化响应
  const authResponse: AuthResponseDto = {
    profile,
    token: {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600,
    },
  }

  return authResponse
}

/**
 * 确保所有 Prisma 数据库表存在
 * 解决测试环境中可能遇到的表不存在问题
 * @param prisma PrismaService 实例
 */
export async function ensurePrismaTablesExist(prisma: PrismaService): Promise<void> {
  // 尝试简单查询各个表以确保它们存在
  // 如果表不存在会抛出异常
  await prisma.$transaction([
    prisma.user.findFirst({ take: 1 }),
    prisma.character.findFirst({ take: 1 }),
    prisma.story.findFirst({ take: 1 }),
    prisma.message.findFirst({ take: 1 }),
    prisma.sharedStory.findFirst({ take: 1 }),
  ])
  //
}


/**
 * Clean up SSE-specific test data
 * @param prisma Prisma service
 */
export async function cleanupSSETestData(prisma: PrismaService) {
  try {
    // First run the standard cleanup
    await cleanupTestData(prisma)

    // Additional SSE-specific cleanup if needed
    // For example, clear any SSE connection states, metrics, or temporary data
    // This is placeholder for future SSE-specific cleanup needs
  } catch (error) {
    // Ensure we don't fail the test cleanup
    console.error('Error during SSE-specific cleanup:', error)
  }
}
