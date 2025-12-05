import { Injectable } from '@nestjs/common'
import { AdminMenuType, AdminMenu } from '@prisma/client'


import { PrismaService } from '@/prisma/prisma.service'
import { CreateMenuDto, UpdateMenuDto, AdminMenuResponseDto } from '../dto/menu.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminMenuResponseDto[]> {
    const menus = await this.prisma.getClient().adminMenu.findMany({ orderBy: { sort: 'asc' } })
    return menus.map(menu => this.toDto(menu))
  }

  async tree(): Promise<AdminMenuResponseDto[]> {
    const menus = await this.prisma.getClient().adminMenu.findMany({ orderBy: { sort: 'asc' } })
    const map = new Map<string, any>()
    menus.forEach(m => map.set(m.id, { ...m, children: [] as any[] }))
    const roots: any[] = []
    menus.forEach(m => {
      const node = map.get(m.id)
      if (m.parentId && map.has(m.parentId)) {
        map.get(m.parentId).children.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots.map(node => this.toDto(node))
  }

  async create(dto: CreateMenuDto): Promise<AdminMenuResponseDto> {
    if (dto.parentId) {
      const parent = await this.prisma.getClient().adminMenu.findUnique({ where: { id: dto.parentId } })
      if (!parent) throw new DomainException('Parent menu not found', { code: ErrorCode.MENU_NOT_FOUND, args: { parentId: dto.parentId } })
    }
    const created = await this.prisma.getClient().adminMenu.create({
      data: {
        parentId: dto.parentId || null,
        type: dto.type,
        title: dto.title,
        code: dto.code,
        path: dto.path,
        icon: dto.icon,
        i18nKey: dto.i18nKey,
        sort: dto.sort ?? 0,
        isShow: dto.isShow ?? true,
      },
    })
    return this.toDto({ ...created, children: [] })
  }

  async update(id: string, dto: UpdateMenuDto): Promise<AdminMenuResponseDto> {
    const exists = await this.prisma.getClient().adminMenu.findUnique({ where: { id } })
    if (!exists) throw new DomainException('Menu not found', { code: ErrorCode.MENU_NOT_FOUND, args: { id } })
    const updated = await this.prisma.getClient().adminMenu.update({
      where: { id },
      data: {
        parentId: dto.parentId ?? undefined,
        type: dto.type ?? AdminMenuType.MENU,
        title: dto.title ?? undefined,
        code: dto.code ?? undefined,
        path: dto.path ?? undefined,
        icon: dto.icon ?? undefined,
        i18nKey: dto.i18nKey ?? undefined,
        sort: dto.sort ?? undefined,
        isShow: dto.isShow ?? undefined,
      },
    })
    return this.toDto({ ...updated, children: [] })
  }

  async remove(id: string) {
    const exists = await this.prisma.getClient().adminMenu.findUnique({ where: { id } })
    if (!exists) throw new DomainException('Menu not found', { code: ErrorCode.MENU_NOT_FOUND, args: { id } })
    await this.prisma.getClient().adminMenu.deleteMany({ where: { parentId: id } })
    return this.prisma.getClient().adminMenu.delete({ where: { id } })
  }

  private toDto(menu: (AdminMenu & { children?: any[] }) | any): AdminMenuResponseDto {
    return {
      id: menu.id,
      parentId: menu.parentId,
      type: menu.type,
      title: menu.title,
      code: menu.code,
      path: menu.path,
      icon: menu.icon,
      i18nKey: menu.i18nKey,
      sort: menu.sort,
      isShow: menu.isShow,
    }
  }
}
