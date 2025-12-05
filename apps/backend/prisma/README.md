# Prisma 操作指南

## 目录结构

```
prisma/
├── schema/             # 模型定义文件
│   ├── schema.prisma   # 主配置文件
│   ├── user.prisma     # 用户模型
│   ├── character.prisma # 角色模型
│   └── ...            # 其他模型文件
├── migrations/         # 数据库迁移文件
├── seed/               # 种子数据文件
│   ├── model-seed.ts   # 模型种子数据
│   ├── character-seed.ts # 角色种子数据
│   └── ...            # 其他种子数据文件
└── seed.ts             # 主种子文件
```

## 常用命令

重要：本仓库统一使用脚本入口执行命令，禁止直接调用 pnpm 命令。请使用根目录脚本：./scripts/dx db ...

示例：

```bash
# 生成 Prisma Client
./scripts/dx db generate

# 创建开发环境迁移（推荐传入迁移名）
./scripts/dx db migrate --dev --name "<migration-name>"

# 部署生产迁移
./scripts/dx db migrate --prod

# 重置/填充
./scripts/dx db reset --dev
./scripts/dx db seed --dev

# 格式化 schema
./scripts/dx db format
```

### 基础操作

> ⚠️ **禁止直接使用 `pnpm prisma` 命令**，必须通过 `./scripts/dx db` 执行所有数据库操作。

### 模型操作

1. 修改模型后的流程：

   ```bash
   # 1. 创建迁移
   ./scripts/dx db migrate --dev --name [变更描述]

   # 2. 重新生成客户端
   ./scripts/dx db generate
   ```

2. 使用 Prisma Client:

   ```typescript
   import { PrismaClient } from '@prisma/client'
   const prisma = new PrismaClient()

   // 查询示例
   const users = await prisma.user.findMany()

   // 创建示例
   const newUser = await prisma.user.create({
     data: {
       username: 'test',
       email: 'test@example.com',
       // ...其他字段
     },
   })

   // 更新示例
   const updatedUser = await prisma.user.update({
     where: { id: 'user-id' },
     data: { nickname: '新昵称' },
   })

   // 删除示例
   const deletedUser = await prisma.user.delete({
     where: { id: 'user-id' },
   })

   // 关联查询示例
   const userWithCharacters = await prisma.user.findUnique({
     where: { id: 'user-id' },
     include: { characters: true },
   })
   ```

## 最佳实践

1. **模型设计**：
   - 在 `schema/` 目录中为每个实体创建单独的模型文件
   - 使用合适的数据类型和关系定义
   - 添加适当的索引和约束以提高性能

2. **迁移管理**：
   - 为每次迁移添加有意义的名称
   - 在开发环境中测试迁移后再应用到生产环境
   - 不要手动修改生成的迁移文件，除非你确切知道在做什么

3. **数据操作**：
   - 使用事务处理相关联的数据操作
   - 利用 Prisma 的批量操作提高性能
   - 在查询中只选择需要的字段

4. **种子数据**：
   - 保持种子数据简洁且代表性
   - 使用 `upsert` 操作避免重复创建
   - 为测试环境和开发环境创建不同的种子数据

## 故障排除

1. **迁移失败**：
   - 检查迁移文件中的 SQL 是否有语法错误
   - 确保数据库连接配置正确
   - 执行 `./scripts/dx db reset --dev` 重置数据库（注意：此操作会删除所有数据）

2. **生成客户端失败**：
   - 检查 schema 文件的语法是否正确
   - 确保 Prisma 版本与项目兼容
   - 删除 `node_modules/.prisma` 目录后重试

3. **查询错误**：
   - 确保使用的字段在模型中已定义
   - 检查关系配置是否正确
   - 确保提供了所有必需字段

## 数据库连接

数据库连接配置位于 `.env` 文件中的 `DATABASE_URL` 环境变量：

```
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```

可以为不同环境创建不同的配置：

- `.env.dev` 用于开发环境
- `.env.test` 用于测试环境
- `.env.prod` 用于生产环境

## 参考资源

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma 迁移指南](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API 参考](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
