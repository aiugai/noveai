import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T> {
  @ApiProperty({ description: '业务数据' })
  data: T;

  @ApiProperty({ description: '响应消息' })
  message: string;

  constructor(data: T, message: string) {
    this.data = data;
    this.message = message;
  }
}
