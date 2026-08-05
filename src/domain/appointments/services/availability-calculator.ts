import {
  DayHours,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { DateTime } from 'luxon';
import { Appointment } from '../entities/appointment.entity';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityInput {
  weeklyHours: WeeklyHours;
  durationMinutes: number;
  from: Date;
  to: Date;
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  timezone: string;
  slotStepMinutes?: number;
}

const DAY_KEYS: (keyof WeeklyHours)[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

function parseHm(hm: string, day: DateTime): DateTime {
  const [h, m] = hm.split(':').map(Number);
  return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export class AvailabilityCalculator {
  calculate(input: AvailabilityInput): TimeSlot[] {
    const step = input.slotStepMinutes ?? 15;
    const slots: TimeSlot[] = [];
    let cursor = DateTime.fromJSDate(input.from, {
      zone: input.timezone,
    }).startOf('day');
    const endDay = DateTime.fromJSDate(input.to, {
      zone: input.timezone,
    }).endOf('day');

    while (cursor.toMillis() <= endDay.toMillis()) {
      const dayKey = DAY_KEYS[cursor.weekday - 1];
      const hours: DayHours | null = input.weeklyHours[dayKey];
      if (hours) {
        let slotStart = parseHm(hours.start, cursor);
        const dayEnd = parseHm(hours.end, cursor);

        while (
          slotStart.plus({ minutes: input.durationMinutes }).toMillis() <=
          dayEnd.toMillis()
        ) {
          const slotEnd = slotStart.plus({ minutes: input.durationMinutes });
          const slotStartDate = slotStart.toJSDate();
          const slotEndDate = slotEnd.toJSDate();

          if (slotStartDate >= input.from && slotEndDate <= input.to) {
            const busy =
              input.appointments.some(
                (a) =>
                  a.isActiveSlot() &&
                  overlaps(slotStartDate, slotEndDate, a.startsAt, a.endsAt),
              ) ||
              input.blocks.some((b) =>
                overlaps(slotStartDate, slotEndDate, b.startsAt, b.endsAt),
              );

            if (!busy) {
              slots.push({
                startsAt: slotStartDate,
                endsAt: slotEndDate,
              });
            }
          }

          slotStart = slotStart.plus({ minutes: step });
        }
      }

      cursor = cursor.plus({ days: 1 }).startOf('day');
    }

    return slots;
  }

  isSlotAvailable(input: {
    startsAt: Date;
    endsAt: Date;
    weeklyHours: WeeklyHours;
    appointments: Appointment[];
    blocks: ScheduleBlock[];
    timezone: string;
  }): boolean {
    const localStart = DateTime.fromJSDate(input.startsAt, {
      zone: input.timezone,
    });
    const localEnd = DateTime.fromJSDate(input.endsAt, {
      zone: input.timezone,
    });
    const dayKey = DAY_KEYS[localStart.weekday - 1];
    const hours = input.weeklyHours[dayKey];
    if (!hours) return false;

    const dayStart = parseHm(hours.start, localStart);
    const dayEnd = parseHm(hours.end, localStart);
    if (
      localStart.toMillis() < dayStart.toMillis() ||
      localEnd.toMillis() > dayEnd.toMillis()
    ) {
      return false;
    }

    const busy =
      input.appointments.some(
        (a) =>
          a.isActiveSlot() &&
          overlaps(input.startsAt, input.endsAt, a.startsAt, a.endsAt),
      ) ||
      input.blocks.some((b) =>
        overlaps(input.startsAt, input.endsAt, b.startsAt, b.endsAt),
      );

    return !busy;
  }
}
