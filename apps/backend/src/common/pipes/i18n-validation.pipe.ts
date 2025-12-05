import { PipeTransform, Injectable, ValidationPipe  } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class I18nValidationPipe extends ValidationPipe implements PipeTransform<any> {
  constructor(private readonly i18n: I18nService) {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints
            ? Object.keys(error.constraints).map((key) => {
                const i18nKey = `validation.${key}`;
                return this.i18n.translate(i18nKey, {
                  lang: 'zh-CN', // Default language
                  args: {
                    field: error.property,
                    value: error.value,
                  },
                });
              })
            : [];

          return {
            property: error.property,
            constraints,
          };
        });

        return messages;
      },
    });
  }
}
