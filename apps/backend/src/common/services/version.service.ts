import { Injectable } from '@nestjs/common'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { BackendRuntimeInfoDto, BackendVersionDto } from '@/health/dto/backend-version.dto'
import { EnvService } from '@/common/services/env.service'

const moduleRequire = createRequire(__filename)

@Injectable()
export class VersionService {
  private readonly bootTime = new Date().toISOString()

  constructor(private readonly env: EnvService) {}

  getBackendVersion(): BackendVersionDto {
    const version =
      this.env.getString('APP_VERSION') ||
      this.readPackageVersion(join('apps', 'backend', 'package.json')) ||
      '0.0.0'

    const gitSha =
      this.env.getString('GIT_SHA') ||
      this.env.getString('BUILD_GIT_SHA') ||
      this.env.getString('GITHUB_SHA') ||
      undefined

    const buildTime =
      this.env.getString('BUILD_TIME') || this.env.getString('BUILD_TIMESTAMP') || this.bootTime

    const runtime: BackendRuntimeInfoDto = {
      node: process.version,
      nest: this.readModuleVersion('@nestjs/core'),
      prisma: this.readModuleVersion('@prisma/client'),
    }

    const payload: BackendVersionDto = {
      app: '@ai/backend',
      version,
      gitSha,
      gitShortSha: gitSha ? gitSha.substring(0, 7) : undefined,
      buildTime,
      runtime,
      environment: this.env.getString('APP_ENV') || this.env.getString('NODE_ENV') || 'development',
    }
    return payload
  }

  private readPackageVersion(relativePath: string): string | undefined {
    try {
      const fullPath = join(process.cwd(), relativePath)
      const raw = readFileSync(fullPath, 'utf8')
      const pkg = JSON.parse(raw)
      return typeof pkg.version === 'string' ? pkg.version : undefined
    } catch {
      return undefined
    }
  }

  private readModuleVersion(moduleName: string): string | undefined {
    try {
      const pkgPath = moduleRequire.resolve(`${moduleName}/package.json`)
      const raw = readFileSync(pkgPath, 'utf8')
      const pkg = JSON.parse(raw)
      return typeof pkg.version === 'string' ? pkg.version : undefined
    } catch {
      return undefined
    }
  }
}
