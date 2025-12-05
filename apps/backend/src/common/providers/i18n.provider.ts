import { Provider } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export const I18N_PROVIDER = 'I18N_PROVIDER';

export const i18nProvider: Provider = {
  provide: I18N_PROVIDER,
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useFactory: (i18nService: I18nService, request: Request) => {
    const lang = request.headers['accept-language'] || 'zh-CN';
    return {
      translate: (key: string, options?: any) => {
        return i18nService.translate(key, {
          lang,
          ...options,
        });
      },
      getLanguage: () => lang,
    };
  },
  inject: [I18nService, REQUEST],
};
