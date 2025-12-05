import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'

import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@prisma/client'

import {
  CreateAdminUserDto,
  ResetAdminPasswordDto,
  UpdateAdminUserDto,
  AdminUserResponseDto,
  AdminAssignedRoleDto,
} from '../dto/admin-user.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class AdminUserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminUserResponseDto[]> {
    const users = await this.prisma.getClient().adminUser.findMany({
      orderBy: { createTime: 'desc' },
      include: { roles: { include: { role: true } } },
    })
    return users.map(user => this.mapUser(user))
  }

  async create(dto: CreateAdminUserDto): Promise<AdminUserResponseDto> {
    const exists = await this.prisma.getClient().adminUser.findUnique({ where: { username: dto.username } })
    if (exists) {
      throw new DomainException('Admin user already exists', { code: ErrorCode.AUTH_EMAIL_ALREADY_TAKEN, args: { username: dto.username } })
    }
    const password = await bcrypt.hash(dto.password, 10)
    const created = await this.prisma.getClient().adminUser.create({
      data: {
        username: dto.username,
        password,
        email: dto.email,
        nickName: dto.nickName,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map(roleId => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    })
    return this.mapUser(created)
  }

  async update(id: string, dto: UpdateAdminUserDto): Promise<AdminUserResponseDto> {
    const admin = await this.prisma.getClient().adminUser.findUnique({ where: { id } })
    if (!admin) throw new DomainException('Admin user not found', { code: ErrorCode.ADMIN_NOT_FOUND, args: { id } })

    const updated = await this.prisma.getClient().adminUser.update({
      where: { id },
      data: {
        email: dto.email ?? undefined,
        nickName: dto.nickName ?? undefined,
        isFrozen: dto.isFrozen ?? undefined,
        roles: dto.roleIds
          ? {
              deleteMany: {},
              create: dto.roleIds.map(roleId => ({ roleId })),
            }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    })
    return this.mapUser(updated)
  }

  async resetPassword(id: string, dto: ResetAdminPasswordDto): Promise<void> {
    const admin = await this.prisma.getClient().adminUser.findUnique({ where: { id } })
    if (!admin) throw new DomainException('Admin user not found', { code: ErrorCode.ADMIN_NOT_FOUND, args: { id } })
    const password = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.getClient().adminUser.update({ where: { id }, data: { password } })
  }

  private mapUser(user: Prisma.AdminUserGetPayload<{ include: { roles: { include: { role: true } } } }>): AdminUserResponseDto {
    const roles: AdminAssignedRoleDto[] = user.roles.map(({ role }) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
    }))

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nickName: user.nickName,
      isFrozen: user.isFrozen,
      roles,
    }
  }
}
