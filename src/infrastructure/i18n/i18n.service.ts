import { Injectable } from '@nestjs/common';

import { ErrorCode, ErrorParams } from '@domain/common/exceptions';
import { DEFAULT_LOCALE, dictionaries, Locale } from './locales';

@Injectable()
export class I18nService {
  translate(
    code: ErrorCode,
    params: ErrorParams = {},
    locale: Locale = DEFAULT_LOCALE,
  ): string {
    const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
    const template = dictionary[code] ?? dictionary[ErrorCode.INTERNAL_ERROR];

    return template.replace(/{(\w+)}/g, (match, key) =>
      params[key] !== undefined ? String(params[key]) : match,
    );
  }
}
