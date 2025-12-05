# Prisma 7.0 升级指南

> ⚠️ **注意**：本文档为历史升级记录。日常 Prisma 操作请使用 `./scripts/dx db` 命令，禁止直接使用 `pnpm prisma`。

> 本文档记录从 Prisma 6.x 升级到 7.x 的关键变更和注意事项。

## 一、核心架构变更

### 1.1 引擎架构转变

Prisma 7 默认使用 **TypeScript-based 客户端**（无 Rust 引擎），这是最重大的变更：

| 版本 | 引擎类型 | 数据库连接方式 |
|------|----------|----------------|
| Prisma 6.x | Rust Query Engine | 内置数据库驱动 |
| Prisma 7.x | TypeScript Query Compiler | Driver Adapter |

**关键影响**：
- 不再需要下载 Rust 二进制文件（减少 ~90% 包体积）
- 查询性能提升 ~3.4x（移除跨语言序列化）
- **必须**使用 Driver Adapter 连接数据库

### 1.2 Generator Provider 变更

```prisma
# Prisma 6.x（已弃用）
generator client {
  provider = "prisma-client-js"
}

# Prisma 7.x（推荐）
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"  # 必须指定 output
}
```

> **注意**：`prisma-client-js` 仍可使用但已弃用。如果继续使用它，仍需配置 Driver Adapter。

### 1.3 engineType 选项（不推荐）

Prisma 7 的 `engineType = "library"` 选项**已失效**，无法回退到 Rust 引擎。如果尝试设置：

```prisma
# ❌ 这样设置不会生效
generator client {
  provider   = "prisma-client-js"
  engineType = "library"
}
```

生成的客户端仍会使用 `@prisma/client/runtime/client.js`，导致运行时错误：
```
PrismaClientConstructorValidationError: Using engine type "client" requires
either "adapter" or "accelerateUrl" to be provided to PrismaClient constructor.
```

---

## 二、升级步骤

### 2.1 更新依赖

```bash
# 1. 更新 Prisma 包
pnpm add -D prisma@^7.0.1
pnpm add @prisma/client@^7.0.1

# 2. 安装 Driver Adapter（PostgreSQL）
pnpm add @prisma/adapter-pg pg
pnpm add -D @types/pg
```

### 2.2 创建 prisma.config.ts

Prisma 7 **必须**创建配置文件 `prisma.config.ts`：

```typescript
// apps/backend/prisma.config.ts
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 不再自动加载环境变量，需要显式加载
const appEnv = process.env.APP_ENV || 'development'
const rootDir = path.resolve(__dirname, '../..')

expand(config({ path: path.join(rootDir, `.env.${appEnv}.local`) }))
expand(config({ path: path.join(rootDir, `.env.${appEnv}`) }))

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema',
  migrations: {
    path: './prisma/schema/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

### 2.3 更新 schema.prisma

移除 datasource 中的 url（移到 prisma.config.ts）：

```prisma
# apps/backend/prisma/schema/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  # ❌ 移除: url = env("DATABASE_URL")
}
```

### 2.4 更新 PrismaService

```typescript
// apps/backend/src/prisma/prisma.service.ts
import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null

  constructor(/* ... */) {
    // Prisma 7: 使用 driver adapter 连接 PostgreSQL
    const connectionString = process.env.DATABASE_URL || ''
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)

    super({
      adapter,  // ← 关键：传入 adapter
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    })

    this.pool = pool
  }

  async onModuleDestroy() {
    await this.$disconnect()
    // Prisma 7: 关闭连接池
    if (this.pool) {
      await this.pool.end()
    }
  }
}
```

### 2.5 更新 seed.ts

```typescript
// apps/backend/prisma/seed.ts

// 1. 显式加载环境变量（Prisma 7 不再自动加载）
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import * as path from 'path'

const appEnv = process.env.APP_ENV || 'development'
const rootDir = path.resolve(__dirname, '../../..')
expand(config({ path: path.join(rootDir, `.env.${appEnv}.local`) }))
expand(config({ path: path.join(rootDir, `.env.${appEnv}`) }))

// 2. 使用 Driver Adapter
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || ''
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// 3. 记得关闭连接池
main()
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()  // ← 关闭连接池
  })
```

---

## 三、导入路径修复

### 3.1 PrismaClientKnownRequestError

```typescript
// ❌ Prisma 6.x 写法（已失效）
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

// ✅ Prisma 7.x 写法
import { Prisma } from '@prisma/client'

// 同时声明类型和值
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
```

### 3.2 Decimal

```typescript
// ❌ Prisma 6.x 写法（已失效）
import { Decimal } from '@prisma/client/runtime/library'

// ✅ Prisma 7.x 写法
import { Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const Decimal = Prisma.Decimal
```

---

## 四、常见错误及解决方案

### 4.1 错误：engine type "client" requires adapter

```
PrismaClientConstructorValidationError: Using engine type "client" requires
either "adapter" or "accelerateUrl" to be provided to PrismaClient constructor.
```

**原因**：Prisma 7 默认使用 TypeScript 客户端，必须提供 adapter。

**解决**：在 PrismaClient 构造函数中传入 adapter：
```typescript
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

### 4.2 错误：Cannot read properties of undefined (reading '__internal')

```
TypeError: Cannot read properties of undefined (reading '__internal')
```

**原因**：环境变量未正确加载，或 PrismaClient 初始化方式不兼容。

**解决**：
1. 确保在 import PrismaClient 之前加载环境变量
2. 使用 `new PrismaClient({ adapter })` 而非 `new PrismaClient({})`

### 4.3 错误：path.resolve is undefined

```
TypeError: Cannot read properties of undefined (reading 'resolve')
```

**原因**：ESM/CJS 模块兼容性问题。

**解决**：
```typescript
// ❌ 可能有问题
import path from 'node:path'

// ✅ 更稳定
import * as path from 'path'
```

### 4.4 错误：Output path is required

```
Error: An output path is required for the `prisma-client` generator.
```

**原因**：使用新的 `prisma-client` provider 时必须指定 output。

**解决**：
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"  # ← 必须指定
}
```

---

## 五、关键注意事项

### 5.1 环境变量

Prisma 7 **不再自动加载** `.env` 文件。必须：
1. 在 `prisma.config.ts` 中显式加载
2. 在 `seed.ts` 等脚本中显式加载
3. 确保环境变量在 `import { PrismaClient }` 之前加载

### 5.2 连接池管理

使用 Driver Adapter 后，连接池由你管理：
- 创建：`new Pool({ connectionString })`
- 关闭：`await pool.end()`
- 不再需要 Prisma 的连接池参数（`connection_limit` 等在 URL 中无效）

### 5.3 Generator 选择

| Provider | 状态 | 特点 |
|----------|------|------|
| `prisma-client` | 推荐 | 生成 TypeScript，需指定 output |
| `prisma-client-js` | 已弃用 | 生成 JavaScript，输出到 node_modules |

两者都需要 Driver Adapter，差异主要在输出格式和位置。

### 5.4 不支持的功能

Prisma 7 移除或不支持的环境变量：
- `PRISMA_CLIENT_ENGINE_TYPE`
- `PRISMA_QUERY_ENGINE_LIBRARY`
- `PRISMA_QUERY_ENGINE_BINARY`

---

## 六、验证升级成功

```bash
# 1. 重新生成客户端
./scripts/dx db generate

# 2. 运行构建
./scripts/dx build backend

# 3. 运行 lint
./scripts/dx lint

# 4. 运行 E2E 测试
./scripts/dx test e2e backend apps/backend/e2e/health
./scripts/dx test e2e backend apps/backend/e2e/wallet
./scripts/dx test e2e backend apps/backend/e2e/payment
```

---

## 七、参考资料

- [Prisma 7 升级指南](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Database drivers](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [Use Prisma ORM without Rust engines](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/no-rust-engine)
- [Prisma 7 Release Blog](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)

---

## 八、升级检查清单

- [ ] 更新 `@prisma/client` 和 `prisma` 到 7.x
- [ ] 安装 `@prisma/adapter-pg` 和 `pg`
- [ ] 创建 `prisma.config.ts` 配置文件
- [ ] 更新 `schema.prisma`（移除 datasource url）
- [ ] 更新 `PrismaService` 使用 adapter
- [ ] 更新 `seed.ts` 使用 adapter + 显式环境变量加载
- [ ] 修复 `PrismaClientKnownRequestError` 导入路径
- [ ] 修复 `Decimal` 导入路径
- [ ] 运行 `./scripts/dx db generate`
- [ ] 运行 `./scripts/dx lint`
- [ ] 运行 `./scripts/dx build backend`
- [ ] 运行 E2E 测试验证

---

*文档创建日期：2025-11-27*
*适用版本：Prisma 7.0.1*
