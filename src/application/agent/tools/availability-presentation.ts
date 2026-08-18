import { DateTime } from 'luxon';

import { SlotOption } from '@application/appointments/use-cases/find-availability-options.use-case';

export enum AvailabilityDayPart {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
}

export interface AvailabilityDaySummary {
  date: Date;
  dayParts: AvailabilityDayPart[];
}

export type AvailabilitySegment =
  | {
      kind: 'range';
      firstStart: SlotOption;
      lastStart: SlotOption;
    }
  | {
      kind: 'times';
      slots: SlotOption[];
    };

const SLOT_STEP_MS = 15 * 60_000;
const RANGE_MINIMUM_STARTS = 3;
const DAY_PART_ORDER = [
  AvailabilityDayPart.MORNING,
  AvailabilityDayPart.AFTERNOON,
  AvailabilityDayPart.EVENING,
] as const;

export function filterSlotsByDayPart(
  slots: readonly SlotOption[],
  dayPart: AvailabilityDayPart | undefined,
  timezone: string,
): SlotOption[] {
  if (!dayPart) return [...slots];
  return slots.filter((slot) => dayPartAt(slot.startsAt, timezone) === dayPart);
}

export function summarizeAvailabilityDays(
  slots: readonly SlotOption[],
  timezone: string,
): AvailabilityDaySummary[] {
  const byDay = new Map<string, AvailabilityDaySummary>();

  for (const slot of slots) {
    const local = DateTime.fromJSDate(slot.startsAt, { zone: timezone });
    const key = local.toISODate();
    if (!key) continue;

    const dayPart = dayPartAt(slot.startsAt, timezone);
    const summary = byDay.get(key);
    if (!summary) {
      byDay.set(key, { date: slot.startsAt, dayParts: [dayPart] });
    } else if (!summary.dayParts.includes(dayPart)) {
      summary.dayParts.push(dayPart);
    }
  }

  return [...byDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((day) => ({
      ...day,
      dayParts: [...day.dayParts].sort(
        (a, b) => DAY_PART_ORDER.indexOf(a) - DAY_PART_ORDER.indexOf(b),
      ),
    }));
}

export function buildAvailabilitySegments(
  slots: readonly SlotOption[],
): AvailabilitySegment[] {
  const uniqueStarts = new Map<number, SlotOption>();
  for (const slot of slots) {
    const key = slot.startsAt.getTime();
    if (!uniqueStarts.has(key)) uniqueStarts.set(key, slot);
  }

  const ordered = [...uniqueStarts.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  if (ordered.length === 0) return [];

  const runs: SlotOption[][] = [[ordered[0]]];
  for (const slot of ordered.slice(1)) {
    const current = runs[runs.length - 1];
    const previous = current[current.length - 1];
    if (
      slot.startsAt.getTime() - previous.startsAt.getTime() ===
      SLOT_STEP_MS
    ) {
      current.push(slot);
    } else {
      runs.push([slot]);
    }
  }

  return runs.map((run) =>
    run.length >= RANGE_MINIMUM_STARTS
      ? {
          kind: 'range',
          firstStart: run[0],
          lastStart: run[run.length - 1],
        }
      : { kind: 'times', slots: run },
  );
}

export function dayPartAt(at: Date, timezone: string): AvailabilityDayPart {
  const hour = DateTime.fromJSDate(at, { zone: timezone }).hour;
  if (hour < 12) return AvailabilityDayPart.MORNING;
  if (hour < 18) return AvailabilityDayPart.AFTERNOON;
  return AvailabilityDayPart.EVENING;
}
