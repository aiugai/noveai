import { NestInterceptor, ExecutionContext, CallHandler, Injectable  } from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from 'nestjs-i18n';
import { Request } from 'express';

@Injectable()
export class I18nInterceptor implements NestInterceptor {
  constructor(private readonly i18nService: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    const lang =
      (request.query.lang as string) ||
      (request.headers['x-custom-lang'] as string) ||
      (request.headers['accept-language'] as string) ||
      'zh-CN';

    (request as any).i18nLang = lang;

    return next.handle();
  }
}
