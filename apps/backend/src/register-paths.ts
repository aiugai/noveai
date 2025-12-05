import { register } from 'tsconfig-paths'
import { join } from 'node:path'

register({
  baseUrl: join(__dirname),
  paths: {
    '@/*': ['./*'],
    '@/utils': ['./utils'],
    '@/types': ['./types'],
    '@/common/*': ['./common/*'],
    '@ai/shared': ['../../../packages/shared/src'],
  },
})
