import { MaxDateRangeDaysConstraint } from './max-date-range-days.validator';

describe('MaxDateRangeDaysConstraint', () => {
  const constraint = new MaxDateRangeDaysConstraint();

  it('allows ranges within 92 days', () => {
    expect(
      constraint.validate(undefined, {
        object: { from: '2026-01-01', to: '2026-03-01' },
        value: undefined,
        targetName: 'Dto',
        property: 'from',
        constraints: [],
      }),
    ).toBe(true);
  });

  it('rejects ranges wider than 92 days', () => {
    expect(
      constraint.validate(undefined, {
        object: { from: '2026-01-01', to: '2026-05-01' },
        value: undefined,
        targetName: 'Dto',
        property: 'from',
        constraints: [],
      }),
    ).toBe(false);
  });

  it('skips validation when only one bound is present', () => {
    expect(
      constraint.validate(undefined, {
        object: { from: '2026-01-01' },
        value: undefined,
        targetName: 'Dto',
        property: 'from',
        constraints: [],
      }),
    ).toBe(true);
  });
});
