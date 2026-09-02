import { ConfigService } from '@nestjs/config';

import {
  DomainException,
  ErrorCode,
  InternalError,
} from '@domain/common/exceptions';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * A healthy provider answers a WhatsApp turn in a couple of seconds, so a spent
 * budget means that connection is wedged rather than slow: a second attempt
 * lands on a fresh one instead of burning the conversation into a handoff.
 */
export const MAX_LLM_ATTEMPTS = 2;

/**
 * Total budget per attempt, headers and body. Worst case before the agent gives
 * up is MAX_LLM_ATTEMPTS times this, and the client is waiting on WhatsApp for
 * all of it, so raise it only against measured turn durations.
 */
export function resolveTimeoutMs(config: ConfigService): number {
  const raw = config
    .get<string>('LLM_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS))
    ?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, {
      field: 'LLM_TIMEOUT_MS',
    });
  }
  return value;
}

/**
 * Only transport failures are worth another attempt. A rejected request or an
 * error the provider embedded in the payload would come back the same way.
 */
export function isTransientLlmFailure(error: unknown): boolean {
  if (!(error instanceof DomainException)) return false;
  const { cause } = error.params;
  return cause === 'timeout' || cause === 'network';
}
