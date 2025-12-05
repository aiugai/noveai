# 数据库脚本占位说明

该目录用于存放一次性数据修复 / 自定义迁移脚本。当前仓库没有内置脚本文件，如需编写脚本可参考以下流程：

1. 在本目录新增 `<name>.ts`，使用 `ts-node` 模板（示例见 README 历史版本）。
2. 通过 `./scripts/dx db script <name> --dev` 在开发环境验证；需要执行危险操作时请加 `-Y`。
3. 生产/预发执行前务必评估并备份数据库。

命令行帮助：

```bash
./scripts/dx db script <name> --dev   # 开发环境
./scripts/dx db script <name> --prod  # 生产环境，命令会提示确认
```

脚本默认会加载 `apps/backend` 的环境变量与依赖，执行完毕后请删除或归档脚本以保持目录整洁。
