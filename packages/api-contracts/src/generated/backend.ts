import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const BackendRuntimeInfoDto = z
  .object({
    node: z.string(),
    nest: z.string().optional(),
    prisma: z.string().optional(),
  })
  .passthrough();
const BackendVersionDto = z
  .object({
    app: z.string(),
    version: z.string(),
    gitSha: z.string().optional(),
    gitShortSha: z.string().optional(),
    buildTime: z.string().optional(),
    runtime: BackendRuntimeInfoDto,
    environment: z.string().optional(),
  })
  .passthrough();
const HealthCheckResponseDto = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    backendVersion: BackendVersionDto,
  })
  .passthrough();
const UserProfileResponseDto = z
  .object({
    id: z.string(),
    email: z.string(),
    nickname: z.string().optional(),
    emailVerified: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    membershipTier: z.enum(["NONE", "SMALL", "BIG"]).optional(),
    membershipExpireAt: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const AdminManagedUserDto = z
  .object({
    id: z.string(),
    email: z.string(),
    nickname: z.string().optional(),
    status: z.enum(["active", "inactive", "suspended", "banned"]),
    emailVerified: z.boolean(),
    isGuest: z.boolean(),
    guestRequiresBinding: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    deletedAt: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const AdminUserListResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasNext: z.boolean(),
    items: z.array(AdminManagedUserDto),
  })
  .passthrough();
const AdminCreateUserDto = z
  .object({
    email: z.string(),
    password: z.string(),
    nickname: z.string().optional(),
    status: z.enum(["active", "inactive", "suspended", "banned"]).optional(),
  })
  .passthrough();
const AdminUpdateUserDto = z
  .object({
    email: z.string(),
    nickname: z.string(),
    status: z.enum(["active", "inactive", "suspended", "banned"]),
  })
  .partial()
  .passthrough();
const AdminResetUserPasswordDto = z
  .object({ newPassword: z.string() })
  .passthrough();
const RegisterRequestDto = z
  .object({
    email: z.string(),
    password: z.string(),
    nickname: z.string().optional(),
  })
  .passthrough();
const AuthResponseDto = z
  .object({ accessToken: z.string(), user: UserProfileResponseDto })
  .passthrough();
const LoginRequestDto = z
  .object({ email: z.string(), password: z.string() })
  .passthrough();
const VerifyEmailRequestDto = z
  .object({ email: z.string(), code: z.string() })
  .passthrough();
const ResendVerificationRequestDto = z
  .object({ email: z.string() })
  .passthrough();
const PasswordResetRequestDto = z.object({ email: z.string() }).passthrough();
const VerifyPasswordResetRequestDto = z
  .object({ email: z.string(), code: z.string(), newPassword: z.string() })
  .passthrough();
const ChangePasswordRequestDto = z
  .object({ currentPassword: z.string(), newPassword: z.string() })
  .passthrough();
const AdminRegisterDto = z
  .object({
    username: z.string(),
    password: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
  })
  .passthrough();
const AdminProfileDto = z
  .object({
    id: z.string(),
    username: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    isFrozen: z.boolean().default(false),
    menuPermissions: z.array(z.string()).default([]),
  })
  .passthrough();
const AdminAuthResponseDto = z
  .object({ accessToken: z.string(), admin: AdminProfileDto })
  .passthrough();
const AdminLoginDto = z
  .object({ username: z.string(), password: z.string() })
  .passthrough();
const ChangeAdminPasswordDto = z
  .object({ currentPassword: z.string(), newPassword: z.string() })
  .passthrough();
const AdminAssignedRoleDto = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })
  .passthrough();
const AdminUserResponseDto = z
  .object({
    id: z.string(),
    username: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    isFrozen: z.boolean().default(false),
    roles: z.array(AdminAssignedRoleDto).default([]),
  })
  .passthrough();
const CreateAdminUserDto = z
  .object({
    username: z.string(),
    password: z.string(),
    email: z.string().optional(),
    nickName: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
  })
  .passthrough();
const UpdateAdminUserDto = z
  .object({
    email: z.string(),
    nickName: z.string(),
    roleIds: z.array(z.string()),
    isFrozen: z.boolean(),
  })
  .partial()
  .passthrough();
const ResetAdminPasswordDto = z
  .object({ newPassword: z.string() })
  .passthrough();
const AdminRoleResponseDto = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    menuPermissions: z.array(z.string()).default([]),
  })
  .passthrough();
const CreateRoleDto = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    menuPermissions: z.array(z.string()).optional(),
  })
  .passthrough();
const UpdateRoleDto = z
  .object({
    name: z.string(),
    description: z.string(),
    menuPermissions: z.array(z.string()),
  })
  .partial()
  .passthrough();
const AdminMenuResponseDto = z
  .object({
    id: z.string(),
    parentId: z.string().optional(),
    type: z.enum(["DIRECTORY", "MENU", "FEATURE"]),
    title: z.string(),
    code: z.string().optional(),
    path: z.string().optional(),
    icon: z.string().optional(),
    i18nKey: z.string().optional(),
    sort: z.number().optional(),
    isShow: z.boolean().optional(),
  })
  .passthrough();
const CreateMenuDto = z
  .object({
    parentId: z.string().optional(),
    type: z.enum(["DIRECTORY", "MENU", "FEATURE"]),
    title: z.string(),
    code: z.string().optional(),
    path: z.string().optional(),
    icon: z.string().optional(),
    i18nKey: z.string().optional(),
    sort: z.number().optional(),
    isShow: z.boolean().optional(),
  })
  .passthrough();
const UpdateMenuDto = z
  .object({
    parentId: z.string().optional(),
    type: z.enum(["DIRECTORY", "MENU", "FEATURE"]),
    title: z.string(),
    code: z.string().optional(),
    path: z.string().optional(),
    icon: z.string().optional(),
    i18nKey: z.string().optional(),
    sort: z.number().optional(),
    isShow: z.boolean().optional(),
  })
  .passthrough();
const BasePaginationResponseDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasNext: z.boolean(),
    items: z.array(z.object({}).partial().passthrough()),
  })
  .passthrough();
const PaymentOrderDetailResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    amount: z.string(),
    currency: z.string(),
    channel: z.string(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]),
    externalOrderId: z.string().nullable(),
    sourceType: z.enum(["INTERNAL", "EXTERNAL"]),
    merchantId: z.string().nullable(),
    externalUserId: z.string().nullable(),
    businessOrderId: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    callbackStatus: z.enum(["PENDING", "SUCCESS", "FAILED"]).nullish(),
    callbackAttempts: z.number().nullish(),
    targetAssetTypeId: z.string().nullable(),
    targetAssetAmount: z.string().nullable(),
    exchangeRate: z.string().nullable(),
    paymentDetails: z.object({}).partial().passthrough().nullable(),
    callbackData: z.object({}).partial().passthrough().nullable(),
    expiresAt: z.string().datetime({ offset: true }).nullable(),
  })
  .passthrough();
const SimulateRechargeRequestDto = z
  .object({
    userId: z.string(),
    packageId: z.string(),
    method: z.enum(["WECHAT", "ALIPAY", "CREDIT_CARD"]).optional(),
    targetAssetCode: z.string().optional(),
    success: z.boolean().optional(),
  })
  .passthrough();
const RechargePackageOptionDto = z
  .object({
    id: z.string(),
    displayTitle: z.string(),
    badgeLabel: z.string(),
    priceAmount: z.string(),
    priceCurrency: z.string(),
    baseScore: z.number(),
    bonusPercent: z.number(),
    bonusScore: z.number(),
    totalScore: z.number(),
    sortOrder: z.number(),
  })
  .passthrough();
const PaymentOptionsResponseDto = z
  .object({
    methods: z.array(z.enum(["WECHAT", "ALIPAY", "CREDIT_CARD"])),
    targetAssetCodes: z.array(z.string()),
    settlementCurrency: z.string(),
    packages: z.array(RechargePackageOptionDto),
    exchangeRate: z.number(),
  })
  .passthrough();
const PaymentMethod = z.enum(["WECHAT", "ALIPAY", "CREDIT_CARD"]);
const CreatePaymentOrderRequestDto = z
  .object({
    amount: z.string(),
    currency: z.string(),
    method: PaymentMethod,
    targetAssetCode: z.string().optional(),
    packageId: z.string().optional(),
  })
  .passthrough();
const RechargePackageDetailsDto = z
  .object({
    label: z.string(),
    priceUSD: z.string(),
    baseScore: z.number(),
    bonusPercent: z.number(),
    bonusScore: z.number(),
    totalScore: z.number(),
  })
  .passthrough();
const PaymentDetailsDto = z
  .object({
    requestedMethod: z.string(),
    requested: z.object({}).partial().passthrough(),
    settled: z.object({}).partial().passthrough(),
    package: RechargePackageDetailsDto,
  })
  .partial()
  .passthrough();
const PaymentOrderResponseDto = z
  .object({
    id: z.string(),
    userId: z.string().optional(),
    amount: z.string(),
    currency: z.string(),
    channel: z.string(),
    targetAssetTypeId: z.string().optional(),
    targetAssetAmount: z.string().optional(),
    exchangeRate: z.number().optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]),
    externalOrderId: z.string().optional(),
    paymentDetails: PaymentDetailsDto.optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).optional(),
    returnUrl: z.string().optional(),
    sourceType: z.enum(["INTERNAL", "EXTERNAL"]),
    merchantId: z.string().optional(),
    businessOrderId: z.string().optional(),
    callbackUrl: z.string().optional(),
    callbackStatus: z.string().optional(),
    callbackAttempts: z.number().optional(),
  })
  .passthrough();
const CreateExternalPaymentOrderDto = z
  .object({
    merchantId: z.string(),
    businessOrderId: z.string(),
    retUrl: z.string(),
    extraData: z.string().optional(),
    timestamp: z.number(),
    sign: z.string(),
    packageId: z.string(),
  })
  .passthrough();
const CallbackProductInfoDto = z
  .object({
    id: z.string(),
    name: z.string(),
    displayTitle: z.string(),
    badgeLabel: z.string().optional(),
    priceAmount: z.string(),
    priceCurrency: z.string(),
    baseScore: z.number(),
    bonusScore: z.number(),
    totalScore: z.number(),
  })
  .passthrough();
const ExternalOrderPublicResponseDto = z
  .object({
    id: z.string(),
    amount: z.string(),
    currency: z.string(),
    channel: z.string(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]),
    payUrl: z.string().optional(),
    returnUrl: z.string().optional(),
    businessOrderId: z.string().optional(),
    productInfo: CallbackProductInfoDto.optional(),
    createdAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();
const ExternalOrderStatusResponseDto = z
  .object({
    status: z.enum(["pending", "success", "failed"]),
    productInfo: CallbackProductInfoDto.optional(),
    paidAt: z.string().optional(),
  })
  .passthrough();
const WGQPayCallbackDto = z
  .object({
    merchant_no: z.string(),
    merchant_order_id: z.string(),
    platform_order_id: z.string(),
    timestamp: z.string(),
    attach: z.string().optional(),
    state: z.number(),
    amount: z.number(),
    pay_amount: z.number(),
    code: z.number(),
    message: z.string(),
    sign: z.string(),
  })
  .passthrough();
const AdminCreateRechargePackageDto = z
  .object({
    name: z.string(),
    displayTitle: z.string(),
    badgeLabel: z.string(),
    priceAmount: z.string(),
    priceCurrency: z.string(),
    baseScore: z.number(),
    bonusPercent: z.number(),
    totalScore: z.number(),
    sortOrder: z.number().default(0),
    metadata: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
const RechargePackageResponseDto = z
  .object({
    id: z.string(),
    name: z.string(),
    displayTitle: z.string(),
    badgeLabel: z.string(),
    priceAmount: z.string(),
    priceCurrency: z.string(),
    baseScore: z.number(),
    bonusPercent: z.number(),
    totalScore: z.number(),
    sortOrder: z.number(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    metadata: z.object({}).partial().passthrough().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const AdminUpdateRechargePackageDto = z
  .object({
    name: z.string(),
    displayTitle: z.string(),
    badgeLabel: z.string(),
    priceAmount: z.string(),
    priceCurrency: z.string(),
    baseScore: z.number(),
    bonusPercent: z.number(),
    totalScore: z.number(),
    sortOrder: z.number().default(0),
    metadata: z.object({}).partial().passthrough(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })
  .partial()
  .passthrough();
const CallbackInfoResponseDto = z
  .object({
    orderId: z.string(),
    merchantId: z.string(),
    businessOrderId: z.string(),
    callbackUrl: z.string(),
    returnUrl: z.string().optional(),
    callbackStatus: z.enum(["PENDING", "SUCCESS", "FAILED"]),
    callbackAttempts: z.number(),
    lastCallbackAt: z.string().optional(),
    lastCallbackError: z.string().optional(),
    canRetry: z.boolean(),
  })
  .passthrough();
const SettingResponseDto = z
  .object({
    id: z.string(),
    key: z.string(),
    value: z.string(),
    type: z.string(),
    description: z.string(),
    category: z.string(),
    isSystem: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const CreateSettingDto = z
  .object({
    key: z.string(),
    value: z.object({}).partial().passthrough(),
    type: z.enum(["string", "number", "boolean", "json"]),
    description: z.string(),
    category: z.string(),
    isSystem: z.boolean(),
  })
  .passthrough();
const UpdateSettingDto = z
  .object({
    value: z.object({}).partial().passthrough(),
    type: z.enum(["string", "number", "boolean", "json"]).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isSystem: z.boolean().optional(),
  })
  .passthrough();
const AssetBalanceResponseDto = z
  .object({
    assetTypeId: z.string(),
    code: z.string(),
    balance: z.string(),
    frozenBalance: z.string(),
    totalBalance: z.string(),
    sortOrder: z.number(),
  })
  .passthrough();
const WalletDetailResponseDto = z
  .object({
    id: z.string(),
    userId: z.string().nullable(),
    assets: z.array(AssetBalanceResponseDto),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const AdminDepositRequestDto = z
  .object({
    userId: z.string(),
    assetTypeId: z.string(),
    amount: z.string(),
    reason: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    uniqueId: z.string(),
  })
  .passthrough();
const AdminWithdrawRequestDto = z
  .object({
    userId: z.string(),
    assetTypeId: z.string(),
    amount: z.string(),
    reason: z.string().optional(),
    metadata: z.object({}).partial().passthrough().optional(),
    uniqueId: z.string(),
  })
  .passthrough();
const AssetStatisticsDto = z
  .object({ DIAMOND: z.string(), SCORE: z.string() })
  .partial()
  .passthrough();
const SystemWalletBalanceBreakdownDto = z
  .object({
    walletId: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    balance: AssetStatisticsDto,
    frozenBalance: AssetStatisticsDto.optional(),
  })
  .passthrough();
const SystemWalletCompatibilityGroupDto = z
  .object({
    label: z.string(),
    primary: SystemWalletBalanceBreakdownDto,
    legacy: z.array(SystemWalletBalanceBreakdownDto),
    combined: AssetStatisticsDto,
    legacyShare: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
const SystemWalletCompatibilitySummaryDto = z
  .object({
    aiRevenue: SystemWalletCompatibilityGroupDto,
    marketing: SystemWalletCompatibilityGroupDto,
  })
  .partial()
  .passthrough();
const SystemWalletMigrationMonitorItemDto = z
  .object({
    groupKey: z.string(),
    primaryWalletId: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    legacyWalletIds: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    asset: z.string(),
    combinedBalance: z.string(),
    legacyShare: z.string(),
    note: z.string().optional(),
  })
  .passthrough();
const WalletStatisticsResponseDto = z
  .object({
    recharge: AssetStatisticsDto,
    withdraw: AssetStatisticsDto,
    commission: AssetStatisticsDto,
    consumption: AssetStatisticsDto,
    systemWalletRollup: SystemWalletCompatibilitySummaryDto.optional(),
    migrationMonitor: z.array(SystemWalletMigrationMonitorItemDto).optional(),
  })
  .passthrough();
const SystemWalletItemDto = z
  .object({
    walletId: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    walletName: z.string(),
    displayName: z.string(),
    walletCode: z.string(),
    isAdjustable: z.boolean(),
    assetCode: z.string(),
    assetName: z.string(),
    balance: z.string(),
    frozenBalance: z.string(),
    totalBalance: z.string(),
    updatedAt: z.string().datetime({ offset: true }),
    isLegacy: z.boolean(),
    migrationTarget: z
      .enum([
        "SYSTEM_AI_REVENUE",
        "SYSTEM_GIFT_REVENUE",
        "SYSTEM_MARKET_REVENUE",
        "SYSTEM_MODEL_PROVIDER_COST",
        "SYSTEM_COMMISSION",
        "SYSTEM_MARKETING",
        "SYSTEM_REFUND",
        "SYSTEM_DEPOSIT",
        "SYSTEM_WITHDRAW",
        "SYSTEM_ESCROW_MARKET",
        "SYSTEM_RISK_RESERVE",
        "SYSTEM_RECYCLE",
        "SYSTEM_FEE",
        "SYSTEM_ACTIVITY",
      ])
      .optional(),
  })
  .passthrough();
const SystemWalletGroupDto = z
  .object({ groupName: z.string(), wallets: z.array(SystemWalletItemDto) })
  .passthrough();
const SystemWalletOverviewDto = z
  .object({
    revenue: SystemWalletGroupDto,
    expense: SystemWalletGroupDto,
    transit: SystemWalletGroupDto,
    special: SystemWalletGroupDto,
    legacy: z.array(SystemWalletItemDto),
  })
  .passthrough();
const AdjustSystemWalletDto = z
  .object({
    walletId: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    assetCode: z.enum(["SCORE", "DIAMOND"]),
    amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
    direction: z.enum(["INCREASE", "DECREASE"]),
    reason: z.string().min(5),
  })
  .passthrough();
const SystemWalletOperationLogDto = z
  .object({
    id: z.string(),
    walletId: z.enum([
      "SYSTEM_AI_REVENUE",
      "SYSTEM_GIFT_REVENUE",
      "SYSTEM_MARKET_REVENUE",
      "SYSTEM_MODEL_PROVIDER_COST",
      "SYSTEM_COMMISSION",
      "SYSTEM_MARKETING",
      "SYSTEM_REFUND",
      "SYSTEM_DEPOSIT",
      "SYSTEM_WITHDRAW",
      "SYSTEM_ESCROW_MARKET",
      "SYSTEM_RISK_RESERVE",
      "SYSTEM_RECYCLE",
      "SYSTEM_FEE",
      "SYSTEM_ACTIVITY",
    ]),
    walletName: z.string(),
    assetCode: z.string(),
    direction: z.enum(["INCREASE", "DECREASE"]),
    adjustmentType: z.enum(["manual", "auto"]),
    amount: z.string(),
    balanceBefore: z.string(),
    balanceAfter: z.string(),
    reason: z.string(),
    operatorId: z.string(),
    operatorNickname: z.string(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .passthrough();
const PaginatedSystemWalletOperationLogDto = z
  .object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasNext: z.boolean(),
    items: z.array(SystemWalletOperationLogDto),
  })
  .passthrough();
const SystemWalletMetadataDto = z
  .object({ id: z.string(), name: z.string() })
  .passthrough();
const AssetTypeMetadataDto = z
  .object({ code: z.string(), name: z.string() })
  .passthrough();
const WalletMetadataResponseDto = z
  .object({
    systemWallets: z.array(SystemWalletMetadataDto),
    assetTypes: z.array(AssetTypeMetadataDto),
  })
  .passthrough();
const SnapshotDataPointDto = z
  .object({
    date: z.string(),
    totalBalance: z.string(),
    availableBalance: z.string(),
    frozenBalance: z.string(),
    balanceChange: z.string(),
  })
  .passthrough();
const SnapshotTrendDto = z
  .object({
    assetCode: z.string(),
    assetName: z.string(),
    dataPoints: z.array(SnapshotDataPointDto),
  })
  .passthrough();
const SnapshotHistoryResponseDto = z
  .object({ trends: z.array(SnapshotTrendDto) })
  .passthrough();
const BackfillSnapshotsDto = z
  .object({ startDate: z.string(), endDate: z.string() })
  .passthrough();
const PaymentOrderItemResponseDto = z
  .object({
    id: z.string(),
    userId: z.string(),
    amount: z.string(),
    currency: z.string(),
    channel: z.string(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"]),
    externalOrderId: z.string().nullable(),
    sourceType: z.enum(["INTERNAL", "EXTERNAL"]),
    merchantId: z.string().nullable(),
    externalUserId: z.string().nullable(),
    businessOrderId: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    callbackStatus: z.enum(["PENDING", "SUCCESS", "FAILED"]).nullish(),
    callbackAttempts: z.number().nullish(),
  })
  .passthrough();
const TransactionType = z.enum([
  "RECHARGE",
  "WITHDRAW",
  "TRANSFER",
  "CONSUMPTION",
  "REFUND",
  "FREEZE",
  "UNFREEZE",
  "TIP",
  "COMMISSION",
  "REWARD",
  "ADMIN_ADJUST",
  "SYSTEM_FEE",
]);
const BasePaginationRequestDto = z
  .object({ page: z.number().gte(1), limit: z.number().lte(200) })
  .passthrough();
const BaseResponseDto = z
  .object({ data: z.object({}).partial().passthrough(), message: z.string() })
  .passthrough();
const ErrorResponseDetailDto = z
  .object({
    code: z.enum([
      "AUTH_UNAUTHORIZED",
      "AUTH_INVALID_CREDENTIALS",
      "AUTH_INVALID_VERIFICATION_CODE",
      "AUTH_VERIFICATION_CODE_EXPIRED",
      "AUTH_EMAIL_ALREADY_TAKEN",
      "AUTH_EMAIL_ALREADY_VERIFIED",
      "EMAIL_SEND_FAILED",
      "BAD_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "TOO_MANY_REQUESTS",
      "UNPROCESSABLE_ENTITY",
      "INTERNAL_SERVER_ERROR",
      "USER_NOT_FOUND",
      "ADMIN_NOT_FOUND",
      "ADMIN_INVALID_PASSWORD",
      "ROLE_NOT_FOUND",
      "MENU_NOT_FOUND",
      "SETTINGS_INVALID_JSON",
      "SETTINGS_TYPE_MISMATCH",
      "SETTINGS_JSON_EXPECTED_OBJECT_OR_ARRAY",
      "SETTINGS_NOT_FOUND",
      "WALLET_NOT_FOUND",
      "WALLET_INSUFFICIENT_BALANCE",
      "WALLET_INSUFFICIENT_FROZEN_BALANCE",
      "WALLET_ASSET_NOT_FOUND",
      "WALLET_ASSET_TYPE_NOT_FOUND",
      "WALLET_INVALID_DATE_RANGE",
      "WALLET_SNAPSHOT_INVALID_DATE_RANGE",
      "WALLET_TRANSACTION_FAILED",
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "PAYMENT_RECHARGE_PACKAGE_NOT_FOUND",
      "PAYMENT_RECHARGE_PACKAGE_CURRENCY_MISMATCH",
      "PAYMENT_RECHARGE_PACKAGE_PRICE_MISMATCH",
      "PAYMENT_WITHDRAW_FAILED",
      "PAYMENT_SIGNATURE_INVALID",
      "PAYMENT_SIGNATURE_MISSING",
      "PAYMENT_REQUEST_TIMEOUT",
      "PAYMENT_ORDER_NOT_FOUND",
      "PAYMENT_ORDER_ALREADY_PROCESSED",
      "PAYMENT_INVALID_AMOUNT",
      "PAYMENT_MERCHANT_NOT_FOUND",
      "PAYMENT_MERCHANT_CONFIG_MISSING",
      "PAYMENT_FORBIDDEN",
      "PAYMENT_TOKEN_INVALID",
      "PAYMENT_TOKEN_EXPIRED",
      "PAYMENT_GATEWAY_BUSY",
      "PAYMENT_CALLBACK_FAILED",
      "PAYMENT_AMOUNT_MISMATCH",
      "EXTERNAL_PAYMENT_INVALID_SIGNATURE",
      "EXTERNAL_PAYMENT_TIMESTAMP_EXPIRED",
      "EXTERNAL_PAYMENT_MERCHANT_NOT_FOUND",
      "EXTERNAL_PAYMENT_MERCHANT_DISABLED",
      "EXTERNAL_PAYMENT_DUPLICATE_ORDER",
      "EXTERNAL_PAYMENT_ORDER_NOT_FOUND",
      "AI_PROVIDER_ERROR",
      "AI_PROVIDER_NOT_FOUND",
      "AI_NO_ACTIVE_KEY",
      "PAYMENT_INITIATION_FAILED",
      "PAYMENT_ORDER_ASSET_INFO_MISSING",
      "PAYMENT_THIRD_PARTY_ERROR",
      "PAYMENT_INVALID_AMOUNT_FORMAT",
      "EMAIL_TEST_ONLY",
      "WALLET_TRANSFER_INVALID_AMOUNT",
      "WALLET_TEST_ROLLBACK",
    ]),
    args: z.object({}).partial().passthrough().optional(),
    requestId: z.string().optional(),
  })
  .passthrough();
const ErrorResponseDto = z
  .object({
    status: z.number(),
    error: ErrorResponseDetailDto,
    timestamp: z.string(),
    path: z.string(),
    message: z.object({}).partial().passthrough().optional(),
    debug: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();

export const schemas = {
  BackendRuntimeInfoDto,
  BackendVersionDto,
  HealthCheckResponseDto,
  UserProfileResponseDto,
  AdminManagedUserDto,
  AdminUserListResponseDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminResetUserPasswordDto,
  RegisterRequestDto,
  AuthResponseDto,
  LoginRequestDto,
  VerifyEmailRequestDto,
  ResendVerificationRequestDto,
  PasswordResetRequestDto,
  VerifyPasswordResetRequestDto,
  ChangePasswordRequestDto,
  AdminRegisterDto,
  AdminProfileDto,
  AdminAuthResponseDto,
  AdminLoginDto,
  ChangeAdminPasswordDto,
  AdminAssignedRoleDto,
  AdminUserResponseDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  ResetAdminPasswordDto,
  AdminRoleResponseDto,
  CreateRoleDto,
  UpdateRoleDto,
  AdminMenuResponseDto,
  CreateMenuDto,
  UpdateMenuDto,
  BasePaginationResponseDto,
  PaymentOrderDetailResponseDto,
  SimulateRechargeRequestDto,
  RechargePackageOptionDto,
  PaymentOptionsResponseDto,
  PaymentMethod,
  CreatePaymentOrderRequestDto,
  RechargePackageDetailsDto,
  PaymentDetailsDto,
  PaymentOrderResponseDto,
  CreateExternalPaymentOrderDto,
  CallbackProductInfoDto,
  ExternalOrderPublicResponseDto,
  ExternalOrderStatusResponseDto,
  WGQPayCallbackDto,
  AdminCreateRechargePackageDto,
  RechargePackageResponseDto,
  AdminUpdateRechargePackageDto,
  CallbackInfoResponseDto,
  SettingResponseDto,
  CreateSettingDto,
  UpdateSettingDto,
  AssetBalanceResponseDto,
  WalletDetailResponseDto,
  AdminDepositRequestDto,
  AdminWithdrawRequestDto,
  AssetStatisticsDto,
  SystemWalletBalanceBreakdownDto,
  SystemWalletCompatibilityGroupDto,
  SystemWalletCompatibilitySummaryDto,
  SystemWalletMigrationMonitorItemDto,
  WalletStatisticsResponseDto,
  SystemWalletItemDto,
  SystemWalletGroupDto,
  SystemWalletOverviewDto,
  AdjustSystemWalletDto,
  SystemWalletOperationLogDto,
  PaginatedSystemWalletOperationLogDto,
  SystemWalletMetadataDto,
  AssetTypeMetadataDto,
  WalletMetadataResponseDto,
  SnapshotDataPointDto,
  SnapshotTrendDto,
  SnapshotHistoryResponseDto,
  BackfillSnapshotsDto,
  PaymentOrderItemResponseDto,
  TransactionType,
  BasePaginationRequestDto,
  BaseResponseDto,
  ErrorResponseDetailDto,
  ErrorResponseDto,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/",
    alias: "AppController_getHello",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/auth/login",
    alias: "AdminAuthController_login",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminLoginDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: "get",
    path: "/admin/auth/me",
    alias: "AdminAuthController_me",
    requestFormat: "json",
    response: AdminProfileDto,
  },
  {
    method: "post",
    path: "/admin/auth/password/change",
    alias: "AdminAuthController_changePassword",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: ChangeAdminPasswordDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/auth/register",
    alias: "AdminAuthController_register",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminRegisterDto,
      },
    ],
    response: AdminAuthResponseDto,
  },
  {
    method: "get",
    path: "/admin/members",
    alias: "UserAdminController_list",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().lte(200),
      },
      {
        name: "keyword",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z
          .enum(["active", "inactive", "suspended", "banned"])
          .optional(),
      },
    ],
    response: AdminUserListResponseDto,
  },
  {
    method: "post",
    path: "/admin/members",
    alias: "UserAdminController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminCreateUserDto,
      },
    ],
    response: AdminManagedUserDto,
  },
  {
    method: "get",
    path: "/admin/members/:id",
    alias: "UserAdminController_detail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminManagedUserDto,
  },
  {
    method: "patch",
    path: "/admin/members/:id",
    alias: "UserAdminController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminUpdateUserDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminManagedUserDto,
  },
  {
    method: "delete",
    path: "/admin/members/:id",
    alias: "UserAdminController_remove",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/admin/members/:id/reset-password",
    alias: "UserAdminController_resetPassword",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ newPassword: z.string() }).passthrough(),
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/menus",
    alias: "MenuController_list",
    requestFormat: "json",
    response: z.array(AdminMenuResponseDto),
  },
  {
    method: "post",
    path: "/admin/menus",
    alias: "MenuController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateMenuDto,
      },
    ],
    response: AdminMenuResponseDto,
  },
  {
    method: "patch",
    path: "/admin/menus/:id",
    alias: "MenuController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateMenuDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminMenuResponseDto,
  },
  {
    method: "delete",
    path: "/admin/menus/:id",
    alias: "MenuController_remove",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/payment/orders",
    alias: "PaymentOrdersController_getOrders",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200),
      },
      {
        name: "userId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z
          .enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"])
          .optional(),
      },
      {
        name: "channel",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "startTime",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "endTime",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "sourceType",
        type: "Query",
        schema: z.enum(["INTERNAL", "EXTERNAL"]).optional(),
      },
    ],
    response: BasePaginationResponseDto,
  },
  {
    method: "get",
    path: "/admin/payment/orders/:id",
    alias: "PaymentOrdersController_getOrderDetail",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: PaymentOrderDetailResponseDto,
  },
  {
    method: "post",
    path: "/admin/payment/orders/:id/retry-callback",
    alias: "PaymentOrdersController_retryCallback",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: PaymentOrderDetailResponseDto,
  },
  {
    method: "post",
    path: "/admin/payment/orders/:id/simulate-callback",
    alias: "PaymentOrdersController_simulateCallback",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: PaymentOrderDetailResponseDto,
  },
  {
    method: "post",
    path: "/admin/payment/orders/simulate-recharge",
    alias: "PaymentOrdersController_simulateRecharge",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: SimulateRechargeRequestDto,
      },
    ],
    response: PaymentOrderDetailResponseDto,
  },
  {
    method: "get",
    path: "/admin/payments/orders",
    alias: "AdminPaymentController_listOrders",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200),
      },
      {
        name: "userId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "status",
        type: "Query",
        schema: z
          .enum(["PENDING", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED"])
          .optional(),
      },
      {
        name: "channel",
        type: "Query",
        schema: z.enum(["WGQPAY", "MOCK"]).optional(),
      },
      {
        name: "createdFrom",
        type: "Query",
        schema: z.string().datetime({ offset: true }).optional(),
      },
      {
        name: "createdTo",
        type: "Query",
        schema: z.string().datetime({ offset: true }).optional(),
      },
      {
        name: "externalOrderId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "merchantId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "businessOrderId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "sourceType",
        type: "Query",
        schema: z.enum(["INTERNAL", "EXTERNAL"]).optional(),
      },
    ],
    response: BasePaginationResponseDto,
  },
  {
    method: "get",
    path: "/admin/payments/orders/:id",
    alias: "AdminPaymentController_getOrderById",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: PaymentOrderResponseDto,
  },
  {
    method: "get",
    path: "/admin/payments/orders/:id/callback",
    alias: "AdminPaymentController_getCallbackInfo",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: CallbackInfoResponseDto,
  },
  {
    method: "post",
    path: "/admin/payments/orders/:id/callback/retry",
    alias: "AdminPaymentController_retryCallback",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/payments/recharge-packages",
    alias: "AdminPaymentController_listRechargePackages",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200),
      },
      {
        name: "status",
        type: "Query",
        schema: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      },
    ],
    response: BasePaginationResponseDto,
  },
  {
    method: "post",
    path: "/admin/payments/recharge-packages",
    alias: "AdminPaymentController_createRechargePackage",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminCreateRechargePackageDto,
      },
    ],
    response: RechargePackageResponseDto,
  },
  {
    method: "get",
    path: "/admin/payments/recharge-packages/:id",
    alias: "AdminPaymentController_getRechargePackage",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: RechargePackageResponseDto,
  },
  {
    method: "put",
    path: "/admin/payments/recharge-packages/:id",
    alias: "AdminPaymentController_updateRechargePackage",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminUpdateRechargePackageDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: RechargePackageResponseDto,
  },
  {
    method: "get",
    path: "/admin/roles",
    alias: "RoleController_list",
    requestFormat: "json",
    response: z.array(AdminRoleResponseDto),
  },
  {
    method: "post",
    path: "/admin/roles",
    alias: "RoleController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateRoleDto,
      },
    ],
    response: AdminRoleResponseDto,
  },
  {
    method: "patch",
    path: "/admin/roles/:id",
    alias: "RoleController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateRoleDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminRoleResponseDto,
  },
  {
    method: "delete",
    path: "/admin/roles/:id",
    alias: "RoleController_remove",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/settings",
    alias: "AdminSettingsController_getAllSettings",
    requestFormat: "json",
    parameters: [
      {
        name: "category",
        type: "Query",
        schema: z.string(),
      },
    ],
    response: z.array(SettingResponseDto),
  },
  {
    method: "post",
    path: "/admin/settings",
    alias: "AdminSettingsController_createSetting",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateSettingDto,
      },
    ],
    response: SettingResponseDto,
  },
  {
    method: "patch",
    path: "/admin/settings",
    alias: "AdminSettingsController_reloadSettings",
    requestFormat: "json",
    response: z.void(),
  },
  {
    method: "put",
    path: "/admin/settings/:key",
    alias: "AdminSettingsController_updateSetting",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateSettingDto,
      },
      {
        name: "key",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: SettingResponseDto,
  },
  {
    method: "get",
    path: "/admin/users",
    alias: "AdminUserController_list",
    requestFormat: "json",
    response: z.array(AdminUserResponseDto),
  },
  {
    method: "post",
    path: "/admin/users",
    alias: "AdminUserController_create",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateAdminUserDto,
      },
    ],
    response: AdminUserResponseDto,
  },
  {
    method: "patch",
    path: "/admin/users/:id",
    alias: "AdminUserController_update",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: UpdateAdminUserDto,
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: AdminUserResponseDto,
  },
  {
    method: "post",
    path: "/admin/users/:id/reset-password",
    alias: "AdminUserController_resetPassword",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ newPassword: z.string() }).passthrough(),
      },
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/admin/wallets/metadata",
    alias: "AdminWalletController_getWalletMetadata",
    requestFormat: "json",
    response: WalletMetadataResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/admin/wallets/snapshots/backfill",
    alias: "AdminWalletController_backfillSnapshots",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: BackfillSnapshotsDto,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `请求参数错误`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/admin/wallets/snapshots/manual",
    alias: "AdminWalletController_createManualSnapshot",
    requestFormat: "json",
    response: z.void(),
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/snapshots/trend",
    alias: "AdminWalletController_getSnapshotTrend",
    requestFormat: "json",
    parameters: [
      {
        name: "groupBy",
        type: "Query",
        schema: z.enum(["hour", "day"]).optional().default("day"),
      },
      {
        name: "timeRange",
        type: "Query",
        schema: z.number().gte(1).lte(365).optional().default(30),
      },
      {
        name: "walletId",
        type: "Query",
        schema: z
          .enum([
            "SYSTEM_AI_REVENUE",
            "SYSTEM_GIFT_REVENUE",
            "SYSTEM_MARKET_REVENUE",
            "SYSTEM_MODEL_PROVIDER_COST",
            "SYSTEM_COMMISSION",
            "SYSTEM_MARKETING",
            "SYSTEM_REFUND",
            "SYSTEM_DEPOSIT",
            "SYSTEM_WITHDRAW",
            "SYSTEM_ESCROW_MARKET",
            "SYSTEM_RISK_RESERVE",
            "SYSTEM_RECYCLE",
            "SYSTEM_FEE",
            "SYSTEM_ACTIVITY",
          ])
          .optional(),
      },
      {
        name: "assetCode",
        type: "Query",
        schema: z.enum(["SCORE", "DIAMOND", "USDT"]).optional(),
      },
    ],
    response: SnapshotHistoryResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/statistics/today",
    alias: "AdminWalletController_getTodayStatistics",
    requestFormat: "json",
    response: WalletStatisticsResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/admin/wallets/system/adjust",
    alias: "AdminWalletController_adjustSystemWallet",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdjustSystemWalletDto,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `请求参数错误`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `资产类型不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/system/operations",
    alias: "AdminWalletController_getSystemWalletOperations",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().lte(200),
      },
      {
        name: "walletIds",
        type: "Query",
        schema: z
          .array(
            z.enum([
              "SYSTEM_AI_REVENUE",
              "SYSTEM_GIFT_REVENUE",
              "SYSTEM_MARKET_REVENUE",
              "SYSTEM_MODEL_PROVIDER_COST",
              "SYSTEM_COMMISSION",
              "SYSTEM_MARKETING",
              "SYSTEM_REFUND",
              "SYSTEM_DEPOSIT",
              "SYSTEM_WITHDRAW",
              "SYSTEM_ESCROW_MARKET",
              "SYSTEM_RISK_RESERVE",
              "SYSTEM_RECYCLE",
              "SYSTEM_FEE",
              "SYSTEM_ACTIVITY",
            ])
          )
          .optional(),
      },
      {
        name: "assetCodes",
        type: "Query",
        schema: z.array(z.enum(["SCORE", "DIAMOND"])).optional(),
      },
      {
        name: "adjustmentType",
        type: "Query",
        schema: z.enum(["manual", "auto", "all"]).optional().default("all"),
      },
      {
        name: "startDate",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "endDate",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "operatorKeyword",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: PaginatedSystemWalletOperationLogDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/system/overview",
    alias: "AdminWalletController_getSystemWalletsOverview",
    requestFormat: "json",
    response: SystemWalletOverviewDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/users/:userId/transactions",
    alias: "AdminWalletController_getUserTransactions",
    requestFormat: "json",
    parameters: [
      {
        name: "userId",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200),
      },
      {
        name: "fromWalletId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "toWalletId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "assetTypeId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "type",
        type: "Query",
        schema: z
          .enum([
            "RECHARGE",
            "WITHDRAW",
            "TRANSFER",
            "CONSUMPTION",
            "REFUND",
            "FREEZE",
            "UNFREEZE",
            "TIP",
            "COMMISSION",
            "REWARD",
            "ADMIN_ADJUST",
            "SYSTEM_FEE",
          ])
          .optional(),
      },
    ],
    response: BasePaginationResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/admin/wallets/users/:userId/wallet",
    alias: "AdminWalletController_getUserWallet",
    requestFormat: "json",
    parameters: [
      {
        name: "userId",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: WalletDetailResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `钱包不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/admin/wallets/users/deposit",
    alias: "AdminWalletController_adminDeposit",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminDepositRequestDto,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `请求参数错误`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `用户或资产类型不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/admin/wallets/users/withdraw",
    alias: "AdminWalletController_adminWithdraw",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: AdminWithdrawRequestDto,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `请求参数错误`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `禁止访问`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `用户或资产类型不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/auth/login",
    alias: "AuthController_login",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: LoginRequestDto,
      },
    ],
    response: AuthResponseDto,
  },
  {
    method: "post",
    path: "/auth/password/change",
    alias: "AuthController_changePassword",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: ChangePasswordRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/password/reset-request",
    alias: "AuthController_requestPasswordReset",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/password/reset-verify",
    alias: "AuthController_verifyPasswordReset",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: VerifyPasswordResetRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/register",
    alias: "AuthController_register",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: RegisterRequestDto,
      },
    ],
    response: AuthResponseDto,
  },
  {
    method: "post",
    path: "/auth/resend-verification",
    alias: "AuthController_resendVerification",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ email: z.string() }).passthrough(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/auth/verify-email",
    alias: "AuthController_verifyEmail",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: VerifyEmailRequestDto,
      },
    ],
    response: z.void(),
  },
  {
    method: "get",
    path: "/health",
    alias: "HealthController_healthCheck",
    requestFormat: "json",
    response: HealthCheckResponseDto,
  },
  {
    method: "get",
    path: "/health/liveness",
    alias: "HealthController_liveness",
    requestFormat: "json",
    response: z.unknown(),
  },
  {
    method: "post",
    path: "/payment/callback/:channel",
    alias: "PaymentController_handleCallback",
    description: `Internal endpoint for receiving payment status updates.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        description: `WGQPay 回调负载`,
        type: "Body",
        schema: WGQPayCallbackDto,
      },
      {
        name: "channel",
        type: "Path",
        schema: z.enum(["WGQPAY", "MOCK"]),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Unknown channel or invalid payload`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/payment/external/options",
    alias: "PaymentController_getExternalPaymentOptions",
    description: `外部商户模式获取支付选项，无需登录`,
    requestFormat: "json",
    response: PaymentOptionsResponseDto,
  },
  {
    method: "get",
    path: "/payment/external/order-status",
    alias: "PaymentController_queryExternalOrderStatus",
    description: `外部商户查询订单状态，使用签名验证身份`,
    requestFormat: "json",
    parameters: [
      {
        name: "merchantId",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "businessOrderId",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "timestamp",
        type: "Query",
        schema: z.number(),
      },
      {
        name: "sign",
        type: "Query",
        schema: z.string(),
      },
    ],
    response: ExternalOrderStatusResponseDto,
    errors: [
      {
        status: 400,
        description: `请求参数错误或时间戳过期`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `签名验证失败或商户已禁用`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `商户不存在或订单不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "post",
    path: "/payment/external/orders",
    alias: "PaymentController_createExternalPaymentOrder",
    description: `外部商户模式下创建支付订单，使用签名验证身份`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreateExternalPaymentOrderDto,
      },
    ],
    response: ExternalOrderPublicResponseDto,
    errors: [
      {
        status: 400,
        description: `请求参数错误或时间戳过期`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `签名验证失败或商户已禁用`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `商户不存在`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `订单号重复`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/payment/external/orders/:id",
    alias: "PaymentController_getExternalOrderById",
    description: `外部商户模式查询订单详情，仅限外部订单。返回精简信息，不包含敏感商户数据。`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: ExternalOrderPublicResponseDto,
    errors: [
      {
        status: 404,
        description: `订单不存在或非外部订单`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/payment/options",
    alias: "PaymentController_getPaymentOptions",
    requestFormat: "json",
    response: PaymentOptionsResponseDto,
  },
  {
    method: "post",
    path: "/payment/orders",
    alias: "PaymentController_createPaymentOrder",
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: CreatePaymentOrderRequestDto,
      },
    ],
    response: PaymentOrderResponseDto,
    errors: [
      {
        status: 400,
        description: `Bad Request`,
        schema: z.void(),
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/payment/orders",
    alias: "PaymentController_getMyOrders",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1).optional(),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200).optional(),
      },
    ],
    response: BasePaginationResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/payment/orders/:id",
    alias: "PaymentController_getOrderById",
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: PaymentOrderResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `订单不存在或无权访问`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/users/me",
    alias: "UserController_me",
    requestFormat: "json",
    response: UserProfileResponseDto,
  },
  {
    method: "get",
    path: "/wallets/me",
    alias: "WalletController_getMyWallet",
    requestFormat: "json",
    response: WalletDetailResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
      {
        status: 404,
        description: `钱包不存在`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/wallets/transactions",
    alias: "WalletController_getTransactions",
    requestFormat: "json",
    parameters: [
      {
        name: "page",
        type: "Query",
        schema: z.number().gte(1),
      },
      {
        name: "limit",
        type: "Query",
        schema: z.number().gte(1).lte(200),
      },
      {
        name: "fromWalletId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "toWalletId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "assetTypeId",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "type",
        type: "Query",
        schema: z
          .enum([
            "RECHARGE",
            "WITHDRAW",
            "TRANSFER",
            "CONSUMPTION",
            "REFUND",
            "FREEZE",
            "UNFREEZE",
            "TIP",
            "COMMISSION",
            "REWARD",
            "ADMIN_ADJUST",
            "SYSTEM_FEE",
          ])
          .optional(),
      },
    ],
    response: BasePaginationResponseDto,
    errors: [
      {
        status: 401,
        description: `未授权`,
        schema: z.void(),
      },
    ],
  },
]);

export const aiBackendClient = new Zodios(
  "http://localhost:3005/api/v1",
  endpoints
);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
