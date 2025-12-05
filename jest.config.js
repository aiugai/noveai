/** @type {import('jest').Config} */
export default {
  projects: [
    // Backend项目配置
    {
      displayName: 'backend',
      rootDir: '<rootDir>/apps/backend',
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/e2e/**/*.e2e-spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      collectCoverageFrom: ['**/*.(t|j)s'],
      coverageDirectory: './coverage',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@prisma/client(|/.*)$': '<rootDir>/src/generated/prisma$1',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
  ],
  // 全局配置
  collectCoverageFrom: [
    'apps/*/src/**/*.(t|j)s',
    '!apps/*/src/**/*.spec.ts',
    '!apps/*/src/**/*.e2e-spec.ts',
    '!apps/*/src/**/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
}
