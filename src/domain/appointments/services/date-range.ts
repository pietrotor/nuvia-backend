import { DateTime } from 'luxon';

export interface AppointmentDateRange {
  from: Date;
  toExclusive: Date;
}

export function appointmentDateRangeIn(input: {
  from?: string;
  to?: string;
  now: Date;
  timezone: string;
}): AppointmentDateRange | null {
  const today = DateTime.fromJSDate(input.now, {
    zone: input.timezone,
  }).toISODate()!;
  const fromIso = input.from ?? input.to ?? today;
  const toIso = input.to ?? input.from ?? today;
  const from = DateTime.fromISO(fromIso, { zone: input.timezone }).startOf(
    'day',
  );
  const to = DateTime.fromISO(toIso, { zone: input.timezone }).startOf('day');

  if (to < from) return null;

  return {
    from: from.toJSDate(),
    toExclusive: to.plus({ days: 1 }).toJSDate(),
  };
}
