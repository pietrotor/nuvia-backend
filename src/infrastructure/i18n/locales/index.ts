import { ErrorCode } from '@domain/common/exceptions';
import { es } from './es';

export type Locale = 'es';

export const DEFAULT_LOCALE: Locale = 'es';

export const dictionaries: Record<Locale, Record<ErrorCode, string>> = { es };
