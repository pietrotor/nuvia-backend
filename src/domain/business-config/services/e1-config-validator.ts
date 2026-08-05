import { ValidationError } from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/exceptions/error-code';

import { WeeklyHours } from '../entities/business-config.entity';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertValidWeeklyHours(hours: WeeklyHours): void {
  for (const day of Object.values(hours)) {
    if (day === null) continue;

    if (
      !TIME_PATTERN.test(day.start) ||
      !TIME_PATTERN.test(day.end) ||
      day.start >= day.end
    ) {
      throw new ValidationError(ErrorCode.INVALID_WEEKLY_HOURS);
    }
  }
}

export function assertValidDepositConfiguration(input: {
  requiresDeposit: boolean;
  depositAmount: string | null;
  depositPercent: number | null;
}): void {
  const configured = [
    input.depositAmount !== null,
    input.depositPercent !== null,
  ].filter(Boolean).length;

  if (
    (!input.requiresDeposit && configured !== 0) ||
    (input.requiresDeposit && configured !== 1)
  ) {
    throw new ValidationError(ErrorCode.INVALID_DEPOSIT_CONFIGURATION);
  }
}
