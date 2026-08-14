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

// Why a day has nothing to offer. An empty slot list collapses four different answers into
// one, and "no hay disponibilidad" is the only sentence it can produce.
export enum DayOutcome {
  AVAILABLE = 'available',
  CLOSED = 'closed',
  SERVICE_DOES_NOT_FIT = 'service_does_not_fit',
  FULLY_BOOKED = 'fully_booked',
  TOO_SOON = 'too_soon',
}

export interface DayAvailability {
  date: Date;
  outcome: DayOutcome;
  slots: TimeSlot[];
  // Latest start whose treatment still ends before closing, regardless of who booked what.
  lastStartThatFits: Date | null;
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
  // Kept apart from `from` so a day lost to the booking lead time reports TOO_SOON instead
  // of looking like a day nobody ever had free.
  earliestStartAt?: Date;
}

export const DAY_KEYS: (keyof WeeklyHours)[] = [
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
    return this.calculateByDay(input).flatMap((day) => day.slots);
  }

  calculateByDay(input: AvailabilityInput): DayAvailability[] {
    const days: DayAvailability[] = [];
    let cursor = DateTime.fromJSDate(input.from, {
      zone: input.timezone,
    }).startOf('day');
    const endDay = DateTime.fromJSDate(input.to, {
      zone: input.timezone,
    }).endOf('day');

    while (cursor.toMillis() <= endDay.toMillis()) {
      days.push(this.day(cursor, input));
      cursor = cursor.plus({ days: 1 }).startOf('day');
    }

    return days;
  }

  private day(cursor: DateTime, input: AvailabilityInput): DayAvailability {
    const date = cursor.toJSDate();
    const hours: DayHours | null =
      input.weeklyHours[DAY_KEYS[cursor.weekday - 1]];
    if (!hours) {
      return {
        date,
        outcome: DayOutcome.CLOSED,
        slots: [],
        lastStartThatFits: null,
      };
    }

    const fitting = this.fittingSlots(cursor, hours, input);
    if (fitting.length === 0) {
      return {
        date,
        outcome: DayOutcome.SERVICE_DOES_NOT_FIT,
        slots: [],
        lastStartThatFits: null,
      };
    }

    const lastStartThatFits = fitting[fitting.length - 1].startsAt;
    const notBefore =
      input.earliestStartAt && input.earliestStartAt > input.from
        ? input.earliestStartAt
        : input.from;
    const inWindow = fitting.filter(
      (slot) => slot.startsAt >= notBefore && slot.endsAt <= input.to,
    );

    if (inWindow.length === 0) {
      return {
        date,
        outcome: DayOutcome.TOO_SOON,
        slots: [],
        lastStartThatFits,
      };
    }

    const slots = inWindow.filter((slot) => !this.isBusy(slot, input));

    return {
      date,
      outcome: slots.length ? DayOutcome.AVAILABLE : DayOutcome.FULLY_BOOKED,
      slots,
      lastStartThatFits,
    };
  }

  // Every start whose treatment still ends before closing, before anyone's agenda is
  // considered. An empty result means the service simply does not fit in that day.
  private fittingSlots(
    cursor: DateTime,
    hours: DayHours,
    input: AvailabilityInput,
  ): TimeSlot[] {
    const step = input.slotStepMinutes ?? 15;
    const dayEnd = parseHm(hours.end, cursor);
    const slots: TimeSlot[] = [];

    let slotStart = parseHm(hours.start, cursor);
    while (
      slotStart.plus({ minutes: input.durationMinutes }).toMillis() <=
      dayEnd.toMillis()
    ) {
      slots.push({
        startsAt: slotStart.toJSDate(),
        endsAt: slotStart.plus({ minutes: input.durationMinutes }).toJSDate(),
      });
      slotStart = slotStart.plus({ minutes: step });
    }

    return slots;
  }

  private isBusy(slot: TimeSlot, input: AvailabilityInput): boolean {
    return (
      input.appointments.some(
        (appointment) =>
          appointment.isActiveSlot() &&
          overlaps(
            slot.startsAt,
            slot.endsAt,
            appointment.startsAt,
            appointment.endsAt,
          ),
      ) ||
      input.blocks.some((block) =>
        overlaps(slot.startsAt, slot.endsAt, block.startsAt, block.endsAt),
      )
    );
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
