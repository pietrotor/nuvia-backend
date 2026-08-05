import { appointmentDateRangeIn } from './date-range';

const now = new Date('2026-08-03T20:00:00.000Z');

describe('appointmentDateRangeIn', () => {
  it('uses today in the business timezone when it gets no dates', () => {
    const range = appointmentDateRangeIn({
      now,
      timezone: 'America/La_Paz',
    });

    expect(range?.from.toISOString()).toBe('2026-08-03T04:00:00.000Z');
    expect(range?.toExclusive.toISOString()).toBe('2026-08-04T04:00:00.000Z');
  });

  it('includes the first and last requested days in full', () => {
    const range = appointmentDateRangeIn({
      from: '2026-08-05',
      to: '2026-08-07',
      now,
      timezone: 'America/La_Paz',
    });

    expect(range?.from.toISOString()).toBe('2026-08-05T04:00:00.000Z');
    expect(range?.toExclusive.toISOString()).toBe('2026-08-08T04:00:00.000Z');
  });

  it('uses a single day when it gets only one of the bounds', () => {
    const range = appointmentDateRangeIn({
      from: '2026-08-05',
      now,
      timezone: 'America/La_Paz',
    });

    expect(range?.from.toISOString()).toBe('2026-08-05T04:00:00.000Z');
    expect(range?.toExclusive.toISOString()).toBe('2026-08-06T04:00:00.000Z');
  });

  it('rejects a range whose end precedes its start', () => {
    const range = appointmentDateRangeIn({
      from: '2026-08-07',
      to: '2026-08-05',
      now,
      timezone: 'America/La_Paz',
    });

    expect(range).toBeNull();
  });
});
