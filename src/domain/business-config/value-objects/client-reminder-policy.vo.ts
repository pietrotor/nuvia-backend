import { ValidationError } from '@domain/common/exceptions/domain.exception';
import { ErrorCode } from '@domain/common/exceptions/error-code';

export const CLIENT_REMINDER_OFFSET_CATALOG = [
  '24h',
  '12h',
  '2h',
  '30m',
] as const;

export type ClientReminderOffset =
  (typeof CLIENT_REMINDER_OFFSET_CATALOG)[number];

export const MAX_CLIENT_REMINDER_OFFSETS = 3;

export const CLIENT_REMINDER_OFFSET_MS: Record<ClientReminderOffset, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '30m': 30 * 60 * 1000,
};

export const CLIENT_REMINDER_THANK_YOU_DELAY_MS = 15 * 60 * 1000;

export interface ClientReminderPolicy {
  enabled: boolean;
  offsets: ClientReminderOffset[];
  thankYouAfterVisit: boolean;
}

export const DEFAULT_CLIENT_REMINDER_POLICY: ClientReminderPolicy = {
  enabled: true,
  offsets: ['24h', '2h'],
  thankYouAfterVisit: false,
};

const CATALOG = new Set<string>(CLIENT_REMINDER_OFFSET_CATALOG);

export function isClientReminderOffset(
  value: string,
): value is ClientReminderOffset {
  return CATALOG.has(value);
}

export function mergeClientReminderPolicy(
  value?: Partial<ClientReminderPolicy> | null,
): ClientReminderPolicy {
  const offsets = sanitizeOffsets(value?.offsets);
  return {
    enabled: value?.enabled ?? DEFAULT_CLIENT_REMINDER_POLICY.enabled,
    offsets:
      offsets.length > 0 ? offsets : DEFAULT_CLIENT_REMINDER_POLICY.offsets,
    thankYouAfterVisit:
      value?.thankYouAfterVisit ??
      DEFAULT_CLIENT_REMINDER_POLICY.thankYouAfterVisit,
  };
}

export function assertValidClientReminderPolicy(
  policy: ClientReminderPolicy,
): void {
  const offsets = sanitizeOffsets(policy.offsets);
  if (offsets.length !== policy.offsets.length) {
    throw new InvalidClientReminderPolicyError();
  }
  if (
    policy.enabled &&
    (offsets.length < 1 || offsets.length > MAX_CLIENT_REMINDER_OFFSETS)
  ) {
    throw new InvalidClientReminderPolicyError();
  }
  if (!policy.enabled && offsets.length > MAX_CLIENT_REMINDER_OFFSETS) {
    throw new InvalidClientReminderPolicyError();
  }
}

export class InvalidClientReminderPolicyError extends ValidationError {
  constructor() {
    super(ErrorCode.INVALID_CLIENT_REMINDER_POLICY);
  }
}

function sanitizeOffsets(
  offsets: readonly string[] | undefined,
): ClientReminderOffset[] {
  if (!offsets) return [];
  const unique: ClientReminderOffset[] = [];
  for (const offset of offsets) {
    if (!isClientReminderOffset(offset)) continue;
    if (unique.includes(offset)) continue;
    unique.push(offset);
    if (unique.length >= MAX_CLIENT_REMINDER_OFFSETS) break;
  }
  return unique;
}
