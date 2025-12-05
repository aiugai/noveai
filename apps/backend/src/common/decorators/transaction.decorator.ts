import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';

export const TRANSACTION_KEY = 'TRANSACTION';

/**
 * 事务装饰器
 * 使用方式：@Transaction()
 * 将一个方法包装在事务中执行，如果执行过程中发生异常，事务会自动回滚
 */
export function Transaction() {
  return applyDecorators(UseInterceptors(TransactionInterceptor));
}
