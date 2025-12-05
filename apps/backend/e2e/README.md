# E2E 测试说明

本项目的E2E测试使用Jest和Supertest框架，测试实际API端点的行为。

## 环境配置

E2E测试使用专门的环境变量配置文件 `.env.e2e`，该文件包含了专用于E2E测试的数据库、Redis和其他服务的配置。

## 目录结构

所有后端模块的 E2E 用例均按模块划分目录，形如：

```
apps/backend/e2e/
├── app/
│   └── app.e2e-spec.ts
├── health/
│   └── health.e2e-spec.ts
├── fixtures/
└── helpers/
```

新增模块测试时，请直接在 `apps/backend/e2e/<module>/` 目录下创建 `<module>.e2e-spec.ts`，保持模块内聚。

## 运行测试

所有命令必须通过 `./scripts/dx` 入口执行。

运行整个后端 E2E 目录：

```bash
./scripts/dx test e2e backend apps/backend/e2e
```

运行特定模块的测试文件：

```bash
./scripts/dx test e2e backend apps/backend/e2e/health/health.e2e-spec.ts
```

## 测试数据库

E2E测试使用专门的测试数据库 `ai_roleplay_e2e_test`，测试前会自动重置该数据库。

## 测试用例命名规范

### 稳定可寻址 ID 前缀

为了确保测试用例的可寻址性和稳定性，关键测试用例应使用稳定 ID 前缀：

**格式：** `[TC-<MODULE>-<NUMBER>] <Description>`

**示例：**
```typescript
describe('[TC-SCH-001] SchedulerAdmin (E2E) - Phase 1: Read-only Display', () => {
  it('[TC-SCH-003] should return all scheduled tasks list', async () => {
    // 测试代码
  })
})
```

**命名规则：**
- `TC` = Test Case（测试用例）
- `<MODULE>` = 模块缩写（如 `SCH` = Scheduler, `WLT` = Wallet, `AUTH` = Auth）
- `<NUMBER>` = 三位数字编号（从 001 开始）
- 稳定 ID 前缀应放在描述文本之前，用方括号包裹
- 描述文本使用英文，遵循 `should <action>` 或 `<feature> - <phase>` 格式

**使用场景：**
- 关键功能测试用例（如核心 API、业务流程）
- 需要被脚本或文档引用的测试用例
- Phase 级别的测试套件（如 Phase 1, Phase 2, Phase 3）

**筛选运行：**
使用稳定 ID 前缀可以确保即使测试描述被翻译或修改，仍可通过 ID 稳定引用：

```bash
# 运行特定测试用例
./scripts/dx test e2e backend apps/backend/e2e/scheduler-admin/scheduler-admin.e2e-spec.ts -t "TC-SCH-001"
```

## 注意事项

1. 确保在运行测试前，已经创建了测试数据库
2. E2E测试使用端口3001，确保该端口未被占用
3. 测试使用Redis数据库1，与开发环境分开
4. 测试用例描述统一使用英文，提升代码库国际化一致性
