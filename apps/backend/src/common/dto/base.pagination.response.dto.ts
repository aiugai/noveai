import { ApiProperty } from '@nestjs/swagger';

export class BasePaginationResponseDto<T> {
  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '是否还有下一页' })
  hasNext: boolean;

  @ApiProperty({
    description: '数据列表',
    type: 'array',
    items: {
      type: 'object',
    },
  })
  items: T[];

  constructor(total: number, page: number, limit: number, items: T[]) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.items = items;
    this.hasNext = total > page * limit;
  }

  /**
   * 创建特定类型的分页DTO类
   * @param itemType 项目类型
   * @returns 分页DTO类
   */
  static createPaginationResponseDto<U>(itemType: new () => U) {
    const className = `${itemType.name}PaginationResponseDto`;

    class PaginationResponseDto extends BasePaginationResponseDto<U> {
      @ApiProperty({
        description: '数据列表',
        type: itemType,
        isArray: true,
      })
      items: U[];
    }

    Object.defineProperty(PaginationResponseDto, 'name', { value: className });

    return PaginationResponseDto;
  }
}
