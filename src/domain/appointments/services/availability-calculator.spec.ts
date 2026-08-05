import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { AvailabilityCalculator } from './availability-calculator';
import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

const hours: WeeklyHours = {
  mon: { start: '09:00', end: '12:00' },
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

describe('AvailabilityCalculator', () => {
  const calculator = new AvailabilityCalculator();

  it('offers slots inside opening hours and skips the busy ones', () => {
    const from = new Date('2026-08-03T00:00:00.000Z');
    const to = new Date('2026-08-03T23:59:59.000Z');

    const busy = new Appointment({
      id: 'a1',
      tenantId: 't1',
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T09:00:00.000Z'),
      endsAt: new Date('2026-08-03T10:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
    });

    const slots = calculator.calculate({
      weeklyHours: hours,
      durationMinutes: 60,
      from,
      to,
      appointments: [busy],
      blocks: [],
      timezone: 'UTC',
      slotStepMinutes: 60,
    });

    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-08-03T10:00:00.000Z',
      '2026-08-03T11:00:00.000Z',
    ]);
  });

  it('rejects a slot outside opening hours or blocked', () => {
    const startsAt = new Date('2026-08-03T08:00:00.000Z');
    const endsAt = new Date('2026-08-03T09:00:00.000Z');
    const block = new ScheduleBlock({
      id: 'b1',
      tenantId: 't1',
      professionalId: 'p1',
      startsAt: new Date('2026-08-03T10:00:00.000Z'),
      endsAt: new Date('2026-08-03T11:00:00.000Z'),
      reason: 'almuerzo',
    });

    expect(
      calculator.isSlotAvailable({
        startsAt,
        endsAt,
        weeklyHours: hours,
        appointments: [],
        blocks: [],
        timezone: 'UTC',
      }),
    ).toBe(false);

    expect(
      calculator.isSlotAvailable({
        startsAt: new Date('2026-08-03T10:00:00.000Z'),
        endsAt: new Date('2026-08-03T11:00:00.000Z'),
        weeklyHours: hours,
        appointments: [],
        blocks: [block],
        timezone: 'UTC',
      }),
    ).toBe(false);
  });

  it('reads the weekly hours in the business timezone', () => {
    const slots = calculator.calculate({
      weeklyHours: {
        ...hours,
        mon: { start: '09:00', end: '10:00' },
      },
      durationMinutes: 60,
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.000Z'),
      appointments: [],
      blocks: [],
      timezone: 'America/La_Paz',
      slotStepMinutes: 60,
    });

    expect(slots[0].startsAt.toISOString()).toBe('2026-08-03T13:00:00.000Z');
  });
});
