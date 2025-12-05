import { AdminMenuType, Prisma, PrismaClient, SystemWalletID } from '@prisma/client'
import { seedRechargePackages } from './recharge-packages.seed'
import { seedPaymentMerchants } from './payment-merchants.seed'
import { seedPaymentSettings } from './payment-settings.seed'

const menuDefinitions: Array<{
  code: string
  title: string
  type: AdminMenuType
  sort?: number
  path?: string
  parentCode?: string
}> = [
  // 顶层仪表盘
  {
    code: 'dashboard',
    title: '仪表盘',
    type: AdminMenuType.MENU,
    path: '/dashboard',
    sort: 0,
  },
  {
    code: 'system',
    title: '系统管理',
    type: AdminMenuType.DIRECTORY,
    sort: 10,
  },
  // system.* 模块按 sort 顺序依次为：
  // 角色管理(11) -> 菜单管理(12) -> 管理员(13) -> 前台用户(14) -> 充值订单(15) -> 系统配置(16)
  // 注意：code 与前端 admin-front 中 NAV_ITEMS 的 permission 一一对应，例如：
  // code = 'system.members' <=> permission = 'system.members'
  {
    code: 'system.roles',
    title: '角色管理',
    type: AdminMenuType.MENU,
    path: '/roles',
    parentCode: 'system',
    sort: 11,
  },
  {
    code: 'system.menus',
    title: '菜单管理',
    type: AdminMenuType.MENU,
    path: '/menus',
    parentCode: 'system',
    sort: 12,
  },
  {
    code: 'system.admins',
    title: '管理员',
    type: AdminMenuType.MENU,
    path: '/users',
    parentCode: 'system',
    sort: 13,
  },
  {
    code: 'system.members',
    title: '前台用户',
    type: AdminMenuType.MENU,
    path: '/members',
    parentCode: 'system',
    sort: 14,
  },
  {
    code: 'system.payment-orders',
    title: '充值订单',
    type: AdminMenuType.MENU,
    path: '/payment-orders',
    parentCode: 'system',
    sort: 15,
  },
  {
    code: 'system.settings',
    title: '系统配置',
    type: AdminMenuType.MENU,
    path: '/settings',
    parentCode: 'system',
    sort: 16,
  },
]

export async function seedInfrastructure(prisma: PrismaClient) {
  await seedAdminMenus(prisma)
  await seedAdminRole(prisma)
  await seedAssetTypes(prisma)
  await seedRechargePackages(prisma)
  await seedSystemWallets(prisma)
  await seedPaymentMerchants(prisma)
  await seedPaymentSettings(prisma)
}

async function seedAssetTypes(prisma: PrismaClient) {
  await prisma.assetType.upsert({
    where: { code: 'SCORE' },
    update: {},
    create: {
      code: 'SCORE',
      name: '积分',
      symbol: 'S',
      precision: 6,
      sortOrder: 1,
      isActive: true,
    },
  })
}

async function seedAdminMenus(prisma: PrismaClient) {
  for (const menu of menuDefinitions) {
    const parent = menu.parentCode
      ? await prisma.adminMenu.findUnique({ where: { code: menu.parentCode } })
      : null

    await prisma.adminMenu.upsert({
      where: { code: menu.code },
      update: {
        title: menu.title,
        type: menu.type,
        path: menu.path,
        sort: menu.sort ?? 0,
        parentId: parent?.id ?? null,
      },
      create: {
        code: menu.code,
        title: menu.title,
        type: menu.type,
        path: menu.path,
        sort: menu.sort ?? 0,
        parentId: parent?.id ?? null,
      },
    })
  }
}

async function seedAdminRole(prisma: PrismaClient) {
  const allMenuCodes = menuDefinitions.map(def => def.code)
  await prisma.adminRole.upsert({
    where: { code: 'super_admin' },
    update: {
      name: '超级管理员',
      description: '拥有系统全部权限',
      menuPermissions: allMenuCodes,
      featurePermissions: [],
      apiPermissions: [],
    },
    create: {
      code: 'super_admin',
      name: '超级管理员',
      description: '默认超级管理员角色',
      menuPermissions: allMenuCodes,
      featurePermissions: [],
      apiPermissions: [],
    },
  })
}

async function seedSystemWallets(prisma: PrismaClient) {
  const scoreAsset = await prisma.assetType.findUnique({ where: { code: 'SCORE' } })
  if (!scoreAsset) {
    console.warn('[seed:infrastructure] ⚠️ 未找到 SCORE 资产类型，跳过系统钱包初始化')
    return
  }

  const ensureWalletWithBalance = async (
    walletId: SystemWalletID,
    balance: Prisma.Decimal | string,
  ) => {
    await prisma.wallet.upsert({
      where: { id: walletId },
      update: {},
      create: { id: walletId },
    })

    await prisma.walletAsset.upsert({
      where: {
        walletId_assetTypeId: {
          walletId,
          assetTypeId: scoreAsset.id,
        },
      },
      update: {
        balance: new Prisma.Decimal(balance),
      },
      create: {
        walletId,
        assetTypeId: scoreAsset.id,
        balance: new Prisma.Decimal(balance),
        frozenBalance: new Prisma.Decimal(0),
      },
    })
  }

  await ensureWalletWithBalance(SystemWalletID.SYSTEM_DEPOSIT, '1000000')
  await ensureWalletWithBalance(SystemWalletID.SYSTEM_WITHDRAW, '0')
}
