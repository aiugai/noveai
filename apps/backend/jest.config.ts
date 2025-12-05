import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: ['src/**/*.{ts,tsx,js,jsx}'],
  coverageDirectory: '<rootDir>/coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@prisma/client(|/.*)$': '<rootDir>/src/generated/prisma$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: false,
}

export default config
