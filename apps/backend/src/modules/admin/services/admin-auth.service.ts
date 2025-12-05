import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'

import { PrismaService } from '@/prisma/prisma.service'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { AdminLoginDto, AdminRegisterDto, AdminAuthResponseDto, AdminProfileDto, ChangeAdminPasswordDto } from '../dto/admin-auth.dto'
import { Prisma } from '@prisma/client'

type AdminWithRoles = Prisma.AdminUserGetPayload<{ include: { roles: { include: { role: true } } } }>

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async register(dto: AdminRegisterDto): Promise<AdminAuthResponseDto> {
    const exists = await this.prisma.getClient().adminUser.findUnique({ where: { username: dto.username } })
    if (exists) {
      throw new DomainException('Admin user already exists', { code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN, args: { username: dto.username } })
    }

    const password = await bcrypt.hash(dto.password, 10)
    const admin = await this.prisma.getClient().adminUser.create({
      data: {
        username: dto.username,
        password,
        email: dto.email,
        nickName: dto.nickName,
        roles: dto.roleIds?.length
          ? {
              create: dto.roleIds.map(roleId => ({ roleId })),
            }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    })

    return this.buildAuthResponse(admin)
  }

  async login(dto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const admin = await this.prisma.getClient().adminUser.findUnique({
      where: { username: dto.username },
      include: { roles: { include: { role: true } } },
    })
    if (!admin) {
      throw new DomainException('Invalid username or password', { code: ErrorCode.AUTH_INVALID_CREDENTIALS })
    }

    const matched = await bcrypt.compare(dto.password, admin.password)
    if (!matched) {
      throw new DomainException('Invalid username or password', { code: ErrorCode.AUTH_INVALID_CREDENTIALS })
    }

    if (admin.isFrozen) {
      throw new DomainException('Account is frozen', { code: ErrorCode.AUTH_UNAUTHORIZED })
    }

    return this.buildAuthResponse(admin)
  }

  async profile(adminId: string): Promise<AdminProfileDto> {
    const admin = await this.prisma.getClient().adminUser.findUnique({
      where: { id: adminId },
      include: { roles: { include: { role: true } } },
    })
    if (!admin) {
      throw new DomainException('Admin user not found', { code: ErrorCode.ADMIN_NOT_FOUND, args: { adminId } })
    }
    return this.mapProfile(admin)
  }

  async changePassword(adminId: string, dto: ChangeAdminPasswordDto): Promise<void> {
    const admin = await this.prisma.getClient().adminUser.findUnique({ where: { id: adminId } })
    if (!admin) {
      throw new DomainException('Admin user not found', { code: ErrorCode.ADMIN_NOT_FOUND, args: { adminId } })
    }

    const matched = await bcrypt.compare(dto.currentPassword, admin.password)
    if (!matched) {
      throw new DomainException('当前密码不正确', { code: ErrorCode.ADMIN_INVALID_PASSWORD })
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new DomainException('新密码不能与当前密码相同', { code: ErrorCode.BAD_REQUEST })
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.getClient().adminUser.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    })
  }

  private buildAuthResponse(admin: AdminWithRoles): AdminAuthResponseDto {
    const payload = { sub: admin.id, email: admin.email ?? '' }
    const token = this.jwtService.sign(payload)

    return {
      accessToken: token,
      admin: this.mapProfile(admin),
    }
  }

  private mapProfile(admin: AdminWithRoles): AdminProfileDto {
    const menuPermissions = Array.from(
      new Set(
        admin.roles?.flatMap(roleRef => roleRef.role.menuPermissions ?? []) ?? [],
      ),
    )
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      nickName: admin.nickName,
      isFrozen: admin.isFrozen,
      menuPermissions,
    }
  }
}
