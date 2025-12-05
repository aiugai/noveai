import { Injectable } from '@nestjs/common'

import { AdminRole } from '@prisma/client'

import { PrismaService } from '@/prisma/prisma.service'
import { CreateRoleDto, UpdateRoleDto, AdminRoleResponseDto } from '../dto/role.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminRoleResponseDto[]> {
    const roles = await this.prisma.getClient().adminRole.findMany({ orderBy: { createTime: 'desc' } })
    return roles.map(role => this.toDto(role))
  }

  async create(dto: CreateRoleDto): Promise<AdminRoleResponseDto> {
    const role = await this.prisma.getClient().adminRole.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        menuPermissions: dto.menuPermissions ?? [],
        featurePermissions: [],
        apiPermissions: [],
      },
    })
    return this.toDto(role)
  }

  async update(id: string, dto: UpdateRoleDto): Promise<AdminRoleResponseDto> {
    const exists = await this.prisma.getClient().adminRole.findUnique({ where: { id } })
    if (!exists) throw new DomainException('Role not found', { code: ErrorCode.ROLE_NOT_FOUND, args: { id } })
    const updated = await this.prisma.getClient().adminRole.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        menuPermissions: dto.menuPermissions ?? undefined,
      },
    })
    return this.toDto(updated)
  }

  async remove(id: string) {
    const exists = await this.prisma.getClient().adminRole.findUnique({ where: { id } })
    if (!exists) throw new DomainException('Role not found', { code: ErrorCode.ROLE_NOT_FOUND, args: { id } })
    await this.prisma.getClient().newAdminUserRole.deleteMany({ where: { roleId: id } })
    return this.prisma.getClient().adminRole.delete({ where: { id } })
  }

  private toDto(role: AdminRole): AdminRoleResponseDto {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      menuPermissions: role.menuPermissions ?? [],
    }
  }
}
