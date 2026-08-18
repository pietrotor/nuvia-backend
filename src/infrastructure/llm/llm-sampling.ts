import { ConfigService } from '@nestjs/config';

import { ErrorCode, InternalError } from '@domain/common/exceptions';

/**
 * Not every endpoint declares `temperature`: Gemini on Vertex (the zero data
 * retention route) does not, and OpenRouter's `require_parameters` then filters
 * out every endpoint and answers 404. Leave LLM_TEMPERATURE empty to omit the
 * field and keep the provider default.
 */
export function resolveTemperature(config: ConfigService): number | undefined {
  const raw = config.get<string>('LLM_TEMPERATURE', '0.2')?.trim();
  if (!raw) return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2) {
    throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
      field: 'LLM_TEMPERATURE',
    });
  }
  return value;
}
