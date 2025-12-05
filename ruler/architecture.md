# 架构与技术栈

## 一、项目结构（Monorepo）

```
apps/
├── backend/      # NestJS 11.1.5 + Prisma 6.18.0（端口 3005）
├── front/        # Next.js 15.4.7（端口 3006）
└── admin-front/  # Next.js 15.4.6 + Ant Design（端口 3505）

packages/
├── shared/         # 纯函数/常量/类型（禁止框架依赖）
└── api-contracts/  # OpenAPI → Zod schema / Zodios 客户端
```

---

## 二、统一技术栈

- **后端**：NestJS 11.1.5、PostgreSQL + Prisma 6.18.0、Redis、JWT/Passport、Bull、Swagger、SSE
- **前端（用户）**：Next.js 15.4.7、React 18.2.0、Redux Toolkit 2.6.1、shadcn/ui + Radix UI、TailwindCSS 4.0.6
- **前端（管理）**：Next.js 15.4.6、React 19.0.0、Ant Design 5.26.7、Zustand 5.x
- **开发工具**：pnpm 10.23.0、TypeScript 5.9.2、ESLint @antfu 4.10.1、Prettier 3.6.2、Nx 19.8.14

---

## 三、后端核心模块

### 3.1 身份认证与用户

- `auth`：JWT/OAuth/RBAC/刷新令牌
- `user`：用户管理/配置/关系/凭证
- `admin`：后台管理/角色/菜单/API/消息

### 3.2 AI 核心

- `ai.model`：多供应商抽象层（OpenAI/Anthropic/Google/Mistral/Cohere）+ 计费/健康检查
- `ai.usecase`：用例管理/生成/日志
- `character`：角色市场/卡片解析/评分/收藏
- `chat`：对话处理/SSE 流式/上下文/提示编排
- `preset`：提示模板/配置
- `worldinfo`：世界信息/激活条件

### 3.3 业务逻辑

- `payment`：支付/提现
- `wallet`：积分钱包
- `invite`：多级邀请/佣金
- `activity`：活动/奖励
- `share.story`：故事分享/分叉
- `advertisement`：广告系统

### 3.4 基础设施

- `debug-trace`：调试会话/回放
- `settings`：系统配置
- `file`：S3/R2 文件上传
- `email`：验证码/邮件队列

---

## 四、延伸阅读

为避免重复，以下主题请直接查阅对应文档：

- **事务、模块依赖与详细编码规范** → `@ruler/conventions.md`
- **开发流程、命令、API 合约链路** → `@ruler/development.md`
- **Git 流程与 Issue 规范** → `@ruler/git-workflow.md`
- **设计思考 / 思维方式** → `@ruler/linus-thinking.md`

本文件仅聚焦宏观架构与技术栈。如需执行层面的细化规则，请参照上述文档。
