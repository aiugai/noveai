import { CallHandler, ExecutionContext, NestInterceptor, BadRequestException, Injectable  } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseResponseDto } from '../dto/base.dto';
import { BasePaginationResponseDto } from '../dto/base.pagination.response.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, BaseResponseDto<T> | BasePaginationResponseDto<T> | undefined>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponseDto<T> | BasePaginationResponseDto<T> | undefined> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();

        // 如果响应状态码为204(无内容)，不做处理
        if (response.statusCode === 204) {
          return undefined;
        }

        // 如果已经是标准响应格式，直接报错
        if (
          data &&
          (data instanceof BaseResponseDto || data instanceof BasePaginationResponseDto)
        ) {
          throw new BadRequestException(
            'Response has already been formatted, please remove the response formatting logic in the module',
          );
        }

        // 构造标准响应格式
        // 检查是否为分页数据
        if (data && 'items' in data && 'total' in data && 'page' in data && 'limit' in data) {
          // 将分页数据转换为标准分页响应格式
          return new BasePaginationResponseDto<T>(data.total, data.page, data.limit, data.items);
        }

        // 构造普通响应
        return new BaseResponseDto<T>(data, 'Success');
      }),
    );
  }
}
