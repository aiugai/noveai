# 开发规范与约束

## 一、输出与命令约束

- ✅ **输出语言**：所有输出必须使用中文
- ✅ **命令入口**：统一使用 `./scripts/dx`（本地与 CI/CD 保持一致）
- ✅ **工作目录**：所有命令必须从项目根目录运行
- ⛔ **环境变量**：禁止提交 `.env*` 文件（`.env.development.local` 等本地私有）
- ⛔ **文件存储**：禁止本地持久化（统一 S3/R2）
- ⛔ **类型约束**：禁止使用 `any`（优先 `unknown`/泛型/类型守卫）
- ⛔ **控制器原则**：控制器保持精简，业务逻辑放服务层

---

## 二、代码风格

- 缩进 2 空格 | 行尾 LF | ESLint @antfu 4.10.1 | Prettier 3.6.2 | TypeScript 5.9.2 严格模式

---

## 三、路径映射

- 使用 TypeScript 路径别名（`@ai/shared`、`@/*` 等）
- `@ai/shared` 仅承载纯函数/常量/类型的同构实现，禁止引入框架或 Node 专属依赖
- 避免相对路径导入，特别是跨模块导入

---

## 四、类型约束

- 禁止裸 `any`；为公共 API、DTO、服务返回值提供精确类型
- 必要时优先使用 `unknown`、泛型或类型守卫
- 类型断言需谨慎，作用域限制到最小

---

## 五、架构原则

### 5.1 NestJS 后端

- 遵循模块化架构：controller、service、dto、entities
- 控制器精简（请求处理 + 权限验证），业务逻辑放 service
- 使用装饰器进行验证/授权/事务管理
- 统一获取用户：`@CurrentUser('id')` 获取 `userId`；多字段时用 `@CurrentUser() user: AuthenticatedUser`；仅在必须访问原生 `req/res` 时保留 `@Req()`
- 使用 OpenAPI 装饰器维护 Swagger，供 `./scripts/dx contracts` 生成 `packages/api-contracts`（Zod schema + Zodios 客户端）

### 5.2 Prisma 使用

- Schema 文件：`apps/backend/prisma/schema/*.prisma`
- 工作流：修改 Schema → `format` → `generate` → `migrate`
- 支持模块化 Schema 文件组织
- 枚举优先：使用枚举作为 case 值，而非硬编码小写/大写

### 5.3 前端约定

- 用户端：Next.js 15.4.7 + React 18.2.0 + Redux Toolkit 2.6.1 + shadcn/Radix + TailwindCSS 4.x
- 管理端：Next.js 15.4.6 + React 19.0.0 + Ant Design 5.26.x + Zustand 5（无 Vite/TanStack Query/UnoCSS）
- 统一经由 `@ai/api-contracts` 获取 DTO 与请求封装，页面仅调用 `lib/api.ts` 中的封装方法，禁止重复手写类型
- 所有接口调用都走 `./scripts/dx contracts` 生成的 Zodios 客户端，封装层负责附加 token/错误处理

### 5.4 事务管理规范（Issue #465）

- 🔒 **事务边界**：仅在控制器/Resolver 使用 `@Transaction()`；`service/repository/subscriber` 层禁用
- 🔗 **事务参与**：服务/仓储通过 `prisma.getClient()` 获取当前 CLS 客户端，自动加入当前事务
- ⚙️ **非 HTTP 入口**：消息订阅、Bull 处理器、定时任务等使用 `ClsService.run(() => prisma.runInTransaction(async (tx) => { ... }))`
- 📤 **外部副作用**：事务体内禁止直接执行外部 I/O（事件/HTTP/消息确认）；统一使用 `TransactionEventsService.afterCommit(() => …)` 延迟执行
- 🚫 **流式接口**：SSE/流式响应不加 `@Transaction()`，整个流式过程禁止开启事务
- ⚠️ **ESLint 守护**：根 ESLint 已禁止在 `service/repository/subscriber` 使用 `@Transaction()`，提交前必须通过 `./scripts/dx lint`

### 5.5 模块依赖与关键模式

- **核心依赖**：PrismaModule（数据库）、ConfigModule（配置）、CacheModule（Redis）
- **认证集成**：大多数业务模块应依赖 AuthModule，以 `@UseGuards(JwtAuthGuard)` + RBAC 控制访问
- **跨模块通信**：通过模块导出服务再在目标模块注入，禁止跨模块直接实例化
- **关键模式**：
  - 模块化单体架构，领域边界清晰
  - Prisma schema 按模块拆分（`apps/backend/prisma/schema/*.prisma`），变更走 `format → generate → migrate`
  - 多环境配置优先级：`.env.[env].local` > `.env.[env]`
  - SSE+Redis+Bull 支撑实时/异步能力，保持控制器瘦身、业务在 service
  - JWT + Passport + Swagger + `./scripts/dx contracts`：确保 API 具有认证、文档与自动类型链路

### 5.6 快速参考

- **分页 DTO**：统一使用 `BasePaginationRequestDto`
- **端口固定**：front=3006，admin=3505，backend=3005
- **API 合约**：改动 DTO/API 后必须运行 `./scripts/dx contracts` 并提交 `packages/api-contracts`
- **环境变量**：禁止根 `.env`，一律在 `.env.[env].local` 维护私密配置

---

## 六、环境管理

- 环境分层：`.env.[environment].local` > `.env.[environment]`（`.env` 不使用，存在会报错）
- 复制 `.env.example` 到 `.env.[environment].local` 进行本地配置
- 开发环境数据库连接使用本地 psql 客户端

---

## 七、测试约定

- 后端同时维护 Jest 单元测试（例如 `apps/backend/src/modules/auth/auth.controller.spec.ts`）与 E2E（`apps/backend/e2e/`）
- 运行策略：
  - 单元测试：针对受影响模块执行 `./scripts/dx test unit backend [-t "pattern"]`
  - E2E：按文件逐个运行 `./scripts/dx test e2e backend <file-or-dir> [-t "test case name"]`
- 强制门禁：main 分支提交与 PR 创建必须通过所有相关 E2E
- 测试前可配合 `./scripts/dx db reset --e2e`/`--dev` 获得干净数据库

---

## 八、安全规范

- 所有接口默认需身份验证（RBAC 使用 nest-access-control）
- API 限流：throttler；输入校验：class-validator
- 文件存储必须 S3/R2，不要本地持久化
- 环境变量严控：`.env` 禁止存在，优先 `.env.[environment].local`

---

## 九、错误处理规范

### 9.1 统一错误码体系

项目采用统一的错误码枚举 `ErrorCode`（位于 `@ai/shared`），前后端共用。

**核心原则**:

- ✅ 所有业务异常必须继承 `DomainException`
- ✅ 所有异常必须提供 `ErrorCode`
- ⛔ 禁止直接使用 `BadRequestException('字符串')` 等标准异常

### 9.2 异常抛出规范

**正确示例**:

```typescript
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

// 方式 1: 使用预定义异常类（推荐）
throw new InsufficientBalanceException({
  currentBalance: '5.00',
  requestedAmount: '10.00',
  isFromFreeze: false,
})

// 方式 2: 直接使用 DomainException
throw new DomainException('余额不足', {
  code: ErrorCode.WALLET_INSUFFICIENT_BALANCE,
  args: { current: '5.00', required: '10.00' },
})
```

**错误示例**:

```typescript
// ❌ 禁止：直接使用标准异常
throw new BadRequestException('余额不足,请充值')

// ❌ 禁止：使用 HttpException 但不提供 code
throw new HttpException('余额不足', 400)
```

### 9.3 创建新异常类规范

当需要创建新的业务异常时：

1. 在 `@ai/shared/constants/error-codes.ts` 添加错误码
2. 在对应模块 `exceptions/` 目录创建异常类（继承 `DomainException`）
3. 编写单元测试验证 code/args/status 正确性
4. 前端根据 `ErrorCode` 添加对应的本地化翻译（前端职责，后端无需处理）

**文件组织**:

```
apps/backend/src/modules/wallet/
├── exceptions/
│   ├── insufficient-balance.exception.ts
│   ├── insufficient-balance.exception.spec.ts  # 单元测试
│   ├── guest-trial-ended.exception.ts
│   ├── guest-trial-ended.exception.spec.ts
│   └── index.ts  # 统一导出
```

### 9.4 错误响应结构

前端接收到的错误响应格式：

```typescript
{
  status: 400,
  error: {
    code: 'WALLET_INSUFFICIENT_BALANCE',  // 业务错误码（前端基于此映射本地化消息）
    args: { current: '5.00', required: '10.00' },  // 动态参数（用于消息插值）
    requestId: 'uuid-xxx'  // 请求追踪ID
  },
  timestamp: '2025-10-12T...',
  path: '/api/chat/send'
}
```

**架构说明**：

- 后端仅返回 `code` 和 `args`，不处理多语言文案
- 前端基于 `code` 映射本地化消息，完全掌控 i18n
- 这种职责分离使后端更简洁，前端更灵活

### 9.5 单元测试规范

每个异常类必须包含单元测试，验证 `code`、`args`、`status` 正确性：

```typescript
// insufficient-balance.exception.spec.ts
import { InsufficientBalanceException } from './insufficient-balance.exception'
import { ErrorCode } from '@ai/shared'

describe('InsufficientBalanceException', () => {
  it('should create exception with correct error code (available balance)', () => {
    const exception = new InsufficientBalanceException({
      currentBalance: '5.00',
      requestedAmount: '10.00',
      isFromFreeze: false,
    })

    expect(exception.code).toBe(ErrorCode.WALLET_INSUFFICIENT_BALANCE)
    expect(exception.args).toEqual({
      balanceType: '可用余额',
      current: '5.00',
      required: '10.00',
    })
    expect(exception.getStatus()).toBe(400)
  })

  it('should create exception with correct error code (frozen balance)', () => {
    const exception = new InsufficientBalanceException({
      currentBalance: '3.00',
      requestedAmount: '8.00',
      isFromFreeze: true,
    })

    expect(exception.code).toBe(ErrorCode.WALLET_INSUFFICIENT_FROZEN_BALANCE)
    expect(exception.getStatus()).toBe(400)
  })
})
```

### 9.6 ESLint 强制规则

项目已配置 ESLint 规则禁止直接使用标准异常：

```javascript
// eslint.config.js
{
  files: ['apps/backend/src/modules/**/*.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "NewExpression[callee.name='BadRequestException'][arguments.0.type='Literal']",
        message: '禁止直接使用字符串字面量创建 BadRequestException。请使用 DomainException 或其子类，并提供 ErrorCode。'
      },
      // ... 其他标准异常规则
    ]
  }
}
```

违反规则将导致 ESLint 错误，无法通过 `./scripts/dx lint` 检查。

---

## 十、变更风险评估要求

**所有代码变更必须进行风险评估：**

- **API/数据破坏性检查**：确认是否影响现有接口和数据结构
- **兼容性说明**：新流程如何与现有系统兼容
- **高风险变更需证据**：提供测试结果和回滚方案
- **明确标注假设**：将推测性内容标记为 "assumption"

**以下变更需走单独评审流程：**

- 数据库 Schema 变更（提供迁移策略，评估数据迁移风险）
