import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // 基础配置
    type: 'lib',
    // 强制关闭“编辑器模式”降级，IDE 与 CI 使用同一套规则
    isInEditor: false,

    // 忽略文件模式
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/prisma/generated/**',
      '**/prisma/**/generated/**',
      '**/temp/**',

      // admin 前端仅忽略构建产物，保留源码参与 lint
      'apps/admin-front/dist/**',
      'apps/admin-front/.next/**',
      'apps/admin-front/build/**',
      'apps/backend/src/generated/**',

      '**/src/generated/**',
      'uploads/**',
      'temp/**',
      'sdk/src/**', // SDK 目录由 OpenAPI 生成器管理
      '**/*.md', // 忽略所有 markdown 文件
      'docs/**', // 忽略文档目录
    ],

    // 格式化配置
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },

    // TypeScript 配置
    typescript: true,

    // React 配置
    react: true,

    // 关闭 stylistic 相关规则，统一使用 Prettier 进行代码格式化，避免 ESLint 与 Prettier 相互冲突
    stylistic: false,

    // 自定义规则
    rules: {
      // 可以在这里添加团队自定义规则
      'no-console': 'off',
      // 使用 ts/no-unused-vars 确保前后端统一检查未使用变量/导入
      'ts/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'react/no-array-index-key': 'off',
      'react/no-useless-forward-ref': 'off', // NestJS 和 React 都有 forwardRef，用途不同
      'react/display-name': 'off', // forwardRef 组件不需要强制 displayName
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      'no-case-declarations': 'error',
      'no-redeclare': 'error',
      'no-useless-catch': 'error',
      // 取消对全局 process、Buffer 等的强制要求
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
      // 与 Prettier 冲突或 stylistic 相关的规则已全部关闭
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'antfu/if-newline': 'off',
      'unicorn/prefer-number-properties': 'off',
      // 统一数字字面量大小写（如 0xFFFFFFFF → 0xffffffff）
      // 配置为十六进制小写
      'unicorn/number-literal-case': ['error', { hexadecimalValue: 'lowercase' }],
      'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // 未使用导入交给 ts/no-unused-vars 处理，这里保持关闭
      'unused-imports/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'react-dom/no-missing-button-type': 'off',
      'react-web-api/no-leaked-timeout': 'off',
      'react-web-api/no-leaked-event-listener': 'off',
      'react-refresh/only-export-components': 'off',
      'react/no-nested-component-definitions': 'off',
      'react-dom/no-dangerously-set-innerhtml': 'off',
      // 禁用类型导入的自动修复
      '@typescript-eslint/consistent-type-imports': 'off',
      'import/consistent-type-specifier-style': 'off',
    },
  },
  {
    // 禁用 React 19 相关规则 (仅针对 React 应用)
    files: ['apps/front/**/*.{ts,tsx}', 'apps/admin-front/**/*.{ts,tsx}'],
    rules: {
      'react/no-forward-ref': 'off',
      'react/no-use-context': 'off',
      'react/no-context-provider': 'off',
    },
  },
  {
    // 防止 ESLint 自动移除 NestJS forwardRef (Issue #1482 后续修复)
    // @antfu/eslint-config 的某些规则会将 forwardRef(() => Module) 简化为 () => Module
    // 这会导致 TypeScript 编译错误，因为 NestJS 需要 forwardRef 包装
    //
    // 注意：此配置仅针对后端，前端的 React forwardRef 仍会被检查
    files: ['apps/backend/src/**/*.ts'],
    rules: {
      'react/no-forward-ref': 'off', // NestJS forwardRef 与 React 19 forwardRef 不同
      'react/no-useless-forward-ref': 'off', // NestJS forwardRef 是必需的
      'unicorn/no-useless-spread': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-useless-promise-resolve-reject': 'off',
      'unicorn/consistent-function-scoping': 'off', // forwardRef(() => Module) 不应被视为可提取的函数
      '@typescript-eslint/no-unnecessary-type-constraint': 'off', // forwardRef 的类型约束是必要的
    },
  },
  {
    // 针对测试文件的覆盖规则
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
  {
    // 禁止在 service/repository/subscriber 中使用 @Transaction()
    files: ['apps/backend/src/modules/**/{services,repositories,subscribers}/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn', // TODO(#1401): 改为 error 并修复所有违规代码
        {
          selector: "Decorator[expression.callee.name='Transaction']",
          message:
            '禁止在 service/repository/subscriber 中使用 @Transaction()。请迁移到控制器或改用 prisma.runInTransaction() + afterCommit。',
        },
      ],
    },
  },
  {
    // 禁止在 backend 中直接使用字符串字面量创建标准异常
    files: ['apps/backend/src/modules/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='BadRequestException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 BadRequestException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector: "NewExpression[callee.name='NotFoundException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 NotFoundException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector: "NewExpression[callee.name='ForbiddenException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 ForbiddenException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='UnauthorizedException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 UnauthorizedException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector: "NewExpression[callee.name='ConflictException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 ConflictException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='InternalServerErrorException'][arguments.0.type='Literal']",
          message:
            '禁止直接使用字符串字面量创建 InternalServerErrorException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='BadRequestException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 BadRequestException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='NotFoundException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 NotFoundException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='ForbiddenException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 ForbiddenException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='UnauthorizedException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 UnauthorizedException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='ConflictException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 ConflictException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
        {
          selector:
            "NewExpression[callee.name='InternalServerErrorException'] > ObjectExpression:has(Property[key.name='message'][value.type='Literal'])",
          message:
            '禁止使用 { message: "..." } 对象语法创建 InternalServerErrorException。请使用 DomainException 或其子类，并提供 ErrorCode。',
        },
      ],
    },
  },
  {
    // 禁止在前端代码中使用动态 import 来规避循环依赖（Issue #1118）
    // 注意：门面文件（*Facade.ts）允许使用动态 import 来打破循环依赖
    files: [
      'apps/front/src/store/**/*.ts',
      'apps/front/src/services/**/*.ts',
      'apps/admin-front/src/store/**/*.ts',
      'apps/admin-front/src/services/**/*.ts',
    ],
    ignores: [
      '**/*Facade.ts',
      '**/*facade.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message:
            '禁止使用动态 import()。请使用静态 import 或门面模式（facade）来解决循环依赖问题。参考 Issue #1118。',
        },
      ],
    },
  },
)
