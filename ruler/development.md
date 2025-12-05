# 开发流程与命令系统

## 一、构建与校验约束

### 1.1 构建策略

- 🔨 **构建策略**：按应用分别构建（backend/front/admin），本地禁止 `./scripts/dx build all`；CI 使用 `./scripts/dx build all --prod`
- 🔍 **增量预检**：提交前必须执行 `./scripts/dx lint`；若后端代码有改动需先运行 `./scripts/dx build backend`，最后再按需运行 `./scripts/dx build front` 与 `./scripts/dx build admin`；
- 🚫 禁使用 pnpm npm 等工具命令，所有命令必须使用 ./scripts/dx
- 🚫 **提交前构建**：提交前必须对受影响应用执行构建并通过；构建失败禁止提交

### 1.2 测试与提交流程

- 🧪 **测试矩阵**：
  - 后端既有 Jest 单元测试（例如 `apps/backend/src/modules/auth/auth.controller.spec.ts`）也有 E2E 测试（`apps/backend/e2e/`）
  - **单元测试**：触及 controller/service/exception 时使用 `./scripts/dx test unit backend [-t "pattern"]` 定位并运行受影响用例
  - **E2E 测试**：后端改动需识别受影响的 E2E 文件并逐个运行（`./scripts/dx test e2e backend <file>`），main 分支提交与 PR 创建必须全量通过
- 📋 **提交前检查清单**（四步走）：
  1. 触及后端业务逻辑：先运行受影响的 Jest 单元测试，确保快速反馈
  2. 后端改动：识别并逐个跑受影响的 E2E 用例
  3. 分别构建受影响应用（backend/front/admin）
  4. 执行增量预检（`./scripts/dx lint` 必跑；若后端代码改动先跑 `./scripts/dx build backend`，再按需运行前端与管理后台构建）

### 1.3 Lint 自动修复策略

- **入口命令**：统一使用 `./scripts/dx lint` 进行检查；如需自动修复，使用 `./scripts/dx lint --fix`
- **强制流程**（请严格遵守顺序）：
  - 第一步：运行 `./scripts/dx lint`
  - 如果 lint **没有报错**，可以继续后续流程
  - 如果 lint **有报错**，第二步必须执行：

```bash
./scripts/dx lint --fix
```

  - 第三步：再次运行 `./scripts/dx lint`，若此时仍有错误，才允许在代码中进行手动修改并重复上述流程，直到 `./scripts/dx lint` 通过
- **禁止项**：不要使用 `pnpm lint` / `pnpm lint --fix` 这类脚本绕过 `./scripts/dx` 入口

---

## 二、命令系统

### 2.1 核心规则

- **唯一入口**：所有构建/启动/测试/数据库/脚本命令必须通过 `./scripts/dx` 触发（本地 = CI/CD），严禁直接使用 `pnpm`、`npm`、`nx`、`npx` 或任何其它入口
- **环境标志**：`--dev/--staging/--prod/--test/--e2e`（禁止位置参数）
- **工作目录**：必须从项目根目录运行

### 2.2 常用命令速查

| 类别         | 命令                                          | 说明                                             |
| ------------ | --------------------------------------------- | ------------------------------------------------ |
| **启动服务** | `./scripts/dx start backend --dev`            | 启动后端（端口 3005）                            |
|              | `./scripts/dx start front --dev`              | 启动前端（端口 3006）                            |
|              | `./scripts/dx start admin --dev`              | 启动管理后台（端口 3505）                        |
|              | `./scripts/dx start all`                      | 同时启动所有服务（默认 dev）                     |
| **数据库**   | `./scripts/dx db generate`                    | 生成 Prisma Client                               |
|              | `./scripts/dx db format`                      | 格式化 schema                                    |
|              | `./scripts/dx db migrate --dev --name <名称>` | 创建开发迁移（开发环境必须指定 --name）          |
|              | `./scripts/dx db migrate --prod`              | 部署生产迁移                                     |
|              | `./scripts/dx db reset --dev`                 | 重置数据库（危险）                               |
|              | `./scripts/dx db seed --dev`                  | 填充种子数据                                     |
| **构建**     | `./scripts/dx build backend --dev\|--prod`    | 构建后端                                         |
|              | `./scripts/dx build front --dev\|--prod`      | 构建前端                                         |
|              | `./scripts/dx build admin --dev\|--prod`      | 构建管理后台                                     |
|              | ⚠️ 本地禁止：`./scripts/dx build all`         | 仅 CI 用 `--prod`                                |
| **PR 预检**  | `./scripts/dx lint`                           | 所有代码改动必跑                                 |
|              | `./scripts/dx build backend`                  | 修改后端相关代码时执行                           |
|              | `./scripts/dx build front`                    | 修改用户端前端代码时执行                         |
|              | `./scripts/dx build admin`                    | 修改管理后台代码时执行                           |
| **CI**       | `./scripts/dx prcheck --prod`                 | CI 专用全量校验                                  |
| **测试**     | `./scripts/dx test e2e backend <file>`        | 运行 E2E（逐个运行）                             |
|              | `./scripts/dx lint`                           | 代码检查和格式化                                 |
| **生产**     | `./scripts/dx build backend --prod`           | 生产构建                                         |
|              | `./scripts/dx db migrate --prod`              | 生产迁移                                         |
|              | `./scripts/dx start backend --prod`           | 生产启动                                         |
| **合约**     | `./scripts/dx contracts`                      | 导出 OpenAPI 并刷新 `packages/api-contracts`（后端 DTO/API 改动后必跑） |

---

## 三、前端日志配置

### 3.1 日志级别说明

前端日志系统支持以下级别（按严重程度从低到高）：

- **SILLY** → 最详细的调试信息
- **TRACE** → 跟踪信息
- **DEBUG** → 调试信息（开发环境默认）
- **INFO** → 一般信息
- **WARN** → 警告信息（生产环境默认）
- **ERROR** → 错误信息
- **FATAL** → 致命错误

### 3.2 配置入口（Next.js）

- `front` 与 `admin-front` 均通过 `.env.[environment][.local]` 中的 `NEXT_PUBLIC_LOG_LEVEL`（可选）控制日志级别
- `apps/front/scripts/check-env.js` 会在构建时校验该变量是否合法；非法值会直接导致 `./scripts/dx build front` 失败
- 未配置时默认使用：开发 `DEBUG`，生产 `WARN`

```bash
# 示例：.env.production.local
NEXT_PUBLIC_LOG_LEVEL=WARN  # 允许: SILLY | TRACE | DEBUG | INFO | WARN | ERROR | FATAL
```

### 3.3 调整流程

1. 修改对应环境的 `.env` 文件
2. 重新运行 `./scripts/dx build front` 或 `./scripts/dx build admin --<env>`
3. 重新部署/启动服务以加载新的级别

⚠️ 目前代码中没有读取 `localStorage.logLevel` 的逻辑，无法在运行时临时覆盖；如需切换日志级别只能重新构建。

### 3.4 常见场景

- **生产排查**：将 `.env.production.local` 的值短暂调到 `INFO` 或 `DEBUG`，收集到日志后立即恢复 `WARN`
- **预发布观察**：`.env.staging.local` 常驻 `INFO`，以便在不产生 DEBUG 噪音的情况下多观察一层
- **本地开发**：默认 `DEBUG`，无需额外设置

### 3.5 最佳实践

- 保持生产为 `WARN`，避免长期 `DEBUG`
- 变更级别后务必重新构建所有受影响应用（front、admin-front）
- 在 PR 中注明是否修改过日志级别，防止误入主干

### 3.6 注意事项

1. 当前仓库没有 Vite 前端，因此不需要 `VITE_LOG_LEVEL`
2. 变量只在构建期读取，SSR 与客户端首屏共享相同级别
3. 如果未来实现运行时开关，记得同步更新此文档，避免再引用已不存在的 localStorage 方案

---

## 四、工作流程

### 4.1 新功能开发流程

**前置检查（强制）**：

1. **检查当前分支**：执行 `git branch --show-current`
   - 如果在 `main`/`master` 分支，**禁止开始开发**
   - 必须先获取或创建 Issue ID
   - 创建对应的 issue 分支（如 `feat/123-add-feature`）
2. **确认 Issue 存在**：
   - 如果没有 Issue ID，询问用户提供或使用 `/git-create-issue` 创建
   - 记录 Issue ID 供后续提交使用

**开发流程**：

1. 检查 `apps/backend/src/modules/` 现有模块模式
2. 可使用模块生成器辅助搭建
3. 遵循标准文件结构：controller、service、dto、entities
4. 添加/更新 OpenAPI 装饰器，确保 `./scripts/dx contracts` 能正确生成最新的 `@ai/api-contracts`
5. 更新/新增 E2E 测试（`apps/backend/e2e/`）
6. 更新相关文档

### 4.2 数据库变更流程

```bash
# 1. 修改 schema
vi apps/backend/prisma/schema/*.prisma

# 2. 格式化
./scripts/dx db format

# 3. 生成客户端
./scripts/dx db generate

# 4. 创建迁移（非交互）
./scripts/dx db migrate --dev --name <migration-name>
```

### 4.3 API 变更 → 前端更新链路

```
后端更新 DTO/Service
  ↓
./scripts/dx db migrate --dev --name <migration-name>
  ↓
./scripts/dx contracts            # 导出 OpenAPI + 生成 Zod schema/Zodios 客户端
  ↓
前端更新 `@ai/api-contracts` 引用（封装在 `lib/api.ts`），如有需要再调整页面逻辑
```

**接口改动必做事项（缺一不可）**：
- 更新/添加后端 DTO，并在 controller 上使用 `@ApiOkResponse`/`@ApiCreatedResponse` 绑定响应模型，保证 Swagger 输出准确。
- 运行 `./scripts/dx contracts`，确认 `packages/api-contracts/src/generated/backend.ts` 已更新且纳入提交。
- 检查 `apps/front/src/lib/api.ts`、`apps/admin-front/src/lib/api.ts` 等封装是否需要新增方法或替换旧路径，确保所有页面都通过这些封装调用新接口。
- 再次执行 `./scripts/dx lint` 与受影响应用的构建（backend/front/admin），防止遗漏类型或构建错误。

### 4.4 提交前检查清单（强制）

- [ ] 识别受影响的 E2E 用例并逐个运行通过（后端改动时）
- [ ] 按改动执行增量预检（`./scripts/dx lint` 必跑；若需构建，遵循 backend → front → admin 的顺序）
- [ ] 若涉及 DTO/API：运行 `./scripts/dx contracts` 并提交 `packages/api-contracts` 变更
- [ ] 确认无 `.env` 违规文件
- [ ] 确认 Issue ID 存在并已关联

**注意**：main 分支提交和 PR 创建时，E2E 测试为强制门禁，必须全部通过

### 4.5 调试工作流

**增量预检建议顺序**

本地自检建议按以下顺序执行命令，只有在对应模块确有改动时才继续后续构建；任一步失败需先修复再重试：

1. `./scripts/dx lint`
2. `./scripts/dx build backend`（仅当修改后端代码或共享逻辑被后端使用）
3. `./scripts/dx start backend`（仅当需要验证后端改动；正常情况下不会返回，最多等待 50 秒）
4. `./scripts/dx build front`（仅当修改用户端前端代码）
5. `./scripts/dx build admin`（仅当修改管理后台代码）

---

## 五、Seed 数据架构

### 5.1 目录概览

```text
apps/backend/prisma/
├── seed.ts                 # 入口：顺序执行 infrastructure → bootstrap
├── seed/infrastructure/    # 管理菜单、角色等基础数据（index.ts）
├── seed/bootstrap/         # 默认管理员用户（index.ts）
└── seed/utils/environment.ts
```

### 5.2 数据分层

| 数据类型 | 文件 | 内容 | 幂等策略 |
| --- | --- | --- | --- |
| **Infrastructure** | `seed/infrastructure/index.ts` | 通过 `upsert` 创建后台菜单树和 `super_admin` 角色（包含菜单权限） | `upsert`，每次运行都会回填缺失字段 |
| **Bootstrap** | `seed/bootstrap/index.ts` | 创建默认管理员账号，凭证来源于 `SEED_ADMIN_*` 环境变量（缺省值：admin/admin123） | 查询存在即跳过，避免重复 |

### 5.3 环境策略

`seed.ts` 通过 `shouldRunBootstrap()`（当前恒为 `true`）在所有环境执行两个阶段，因此无需再做生产/开发分支。

| 环境 | Infrastructure | Bootstrap | 备注 |
| --- | --- | --- | --- |
| Development | ✅ | ✅ | 保障本地默认菜单 & 管理员 |
| Staging | ✅ | ✅ | 使用 `SEED_ADMIN_*` 自定义账号 |
| Production | ✅ | ✅ | 不会覆盖已存在的数据；确保提供安全的 `SEED_ADMIN_*` |
| E2E | ✅ | ✅ | 配合 `./scripts/dx db reset --e2e` 使用 |

### 5.3.1 管理员凭证

- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_EMAIL`（可选，见 `seed/bootstrap/index.ts`）
- 未配置时退回默认 `admin`/`admin123`/`admin@example.com`，上线环境务必显式设置

### 5.4 幂等性说明

- Infrastructure 使用 `upsert`，重复执行不会丢失已有菜单排序
- Bootstrap 先查找用户名，不会重复创建；若需要重置凭证，请先删除 `adminUser` 记录再运行 `./scripts/dx db seed --dev`
- E2E 场景如需清空数据，请使用 `./scripts/dx db reset --e2e && ./scripts/dx db seed --e2e`

### 5.5 扩展指引

1. **新增基础数据**：在 `seed/infrastructure/index.ts` 中添加新的 `seedXXX` 函数并在 `seedInfrastructure` 中调用；如需拆分文件，记得从 `index.ts` 导出并在此处汇总
2. **新增引导数据**：在 `seed/bootstrap/index.ts` 中补充逻辑，遵循“存在即跳过”原则，必要时从环境变量读取敏感信息
3. **注册顺序**：所有新种子均由 `seed.ts` 按 “infrastructure → bootstrap” 顺序调用，确保依赖（如角色 ID）已准备好

### 5.6 故障排查

| 问题 | 排查点 | 处理 |
| --- | --- | --- |
| 运行后看不到默认管理员 | 检查 `adminUser` 表是否已存在同名用户；如需重建请删除记录后再执行 seed | 删除冲突记录并重新运行 seed |
| 菜单层级错误 | 新增菜单未在 `menuDefinitions` 中声明 `parentCode` | 更新 `menuDefinitions` 并重新执行 seed |
| 生产环境凭证仍是默认值 | 未显式设置 `SEED_ADMIN_*` | 在部署环境注入自定义变量并重新 seed |

---

## 六、故障排除

| 问题         | 解决方案                        |
| ------------ | ------------------------------- |
| `./scripts/dx contracts` 失败 | 确认后端可启动（或设置 `SKIP_PRISMA_CONNECT=true`），再检查 Swagger 装饰器是否完整 |
| 类型错误     | 运行 `./scripts/dx db generate` |
| 端口占用     | 启动脚本自动清理                |
