import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSetting } from '@prisma/client';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient();
  }

  async findAll(): Promise<SystemSetting[]> {
    const client = this.getClient();
    return client.systemSetting.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async findByKey(key: string): Promise<SystemSetting | null> {
    const client = this.getClient();
    return client.systemSetting.findUnique({
      where: { key },
    });
  }

  async findByCategory(category: string): Promise<SystemSetting[]> {
    const client = this.getClient();
    return client.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  async create(data: {
    key: string;
    value: string;
    type?: string;
    description?: string;
    category?: string;
    isSystem?: boolean;
  }): Promise<SystemSetting> {
    const client = this.getClient();
    return client.systemSetting.create({
      data,
    });
  }

  async update(
    key: string,
    data: {
      value?: string;
      type?: string;
      description?: string;
      category?: string;
      isSystem?: boolean;
    },
  ): Promise<SystemSetting> {
    const client = this.getClient();
    return client.systemSetting.update({
      where: { key },
      data,
    });
  }

  async upsert(data: {
    key: string;
    value: string;
    type?: string;
    description?: string;
    category?: string;
    isSystem?: boolean;
  }): Promise<SystemSetting> {
    const client = this.getClient();
    return client.systemSetting.upsert({
      where: { key: data.key },
      update: {
        value: data.value,
        type: data.type,
        description: data.description,
        category: data.category,
        isSystem: data.isSystem,
        updatedAt: new Date(),
      },
      create: data,
    });
  }

  async delete(key: string): Promise<SystemSetting> {
    const client = this.getClient();
    return client.systemSetting.delete({
      where: { key },
    });
  }
}
