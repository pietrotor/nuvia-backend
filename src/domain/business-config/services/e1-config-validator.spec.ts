import { ValidationError } from '@domain/common/exceptions';

import {
  assertValidDepositConfiguration,
  assertValidWeeklyHours,
} from './e1-config-validator';

describe('E1 configuration validators', () => {
  it('rejects hours whose closing time is not after the opening time', () => {
    expect(() =>
      assertValidWeeklyHours({
        mon: { start: '18:00', end: '09:00' },
        tue: null,
        wed: null,
        thu: null,
        fri: null,
        sat: null,
        sun: null,
      }),
    ).toThrow(ValidationError);
  });

  it('accepts exactly one deposit modality', () => {
    expect(() =>
      assertValidDepositConfiguration({
        requiresDeposit: true,
        depositAmount: '50.00',
        depositPercent: null,
      }),
    ).not.toThrow();
  });

  it('rejects a simultaneous deposit amount and percentage', () => {
    expect(() =>
      assertValidDepositConfiguration({
        requiresDeposit: true,
        depositAmount: '50.00',
        depositPercent: 30,
      }),
    ).toThrow(ValidationError);
  });
});
