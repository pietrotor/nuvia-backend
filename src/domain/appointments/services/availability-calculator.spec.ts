import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { AvailabilityCalculator, DayOutcome } from './availability-calculator';
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
      branchId: 'b1',
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T09:00:00.000Z'),
      endsAt: new Date('2026-08-03T10:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      price: Money.of('150.00', Currency.BOB),
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

  it('tells an overlapping appointment apart from a schedule block', () => {
    const appointment = new Appointment({
      id: 'a1',
      tenantId: 't1',
      branchId: 'b1',
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T10:00:00.000Z'),
      endsAt: new Date('2026-08-03T10:45:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      price: Money.of('150.00', Currency.BOB),
    });
    const block = new ScheduleBlock({
      id: 'b1',
      tenantId: 't1',
      professionalId: 'p1',
      startsAt: new Date('2026-08-03T10:00:00.000Z'),
      endsAt: new Date('2026-08-03T11:00:00.000Z'),
      reason: 'vacaciones',
    });

    expect(
      calculator.slotConflict({
        startsAt: new Date('2026-08-03T09:30:00.000Z'),
        endsAt: new Date('2026-08-03T10:15:00.000Z'),
        appointments: [appointment],
        blocks: [],
      }),
    ).toBe('appointment');

    expect(
      calculator.slotConflict({
        startsAt: new Date('2026-08-03T09:30:00.000Z'),
        endsAt: new Date('2026-08-03T10:15:00.000Z'),
        appointments: [],
        blocks: [block],
      }),
    ).toBe('block');
  });

  // 10:00 booked for any length; a 45-minute service can still start at 09:15, not 09:30.
  it('stops free starts that would overlap an existing booking', () => {
    const busy = new Appointment({
      id: 'a1',
      tenantId: 't1',
      branchId: 'b1',
      clientId: 'c1',
      professionalId: 'p1',
      serviceId: 's1',
      startsAt: new Date('2026-08-03T10:00:00.000Z'),
      endsAt: new Date('2026-08-03T11:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      price: Money.of('150.00', Currency.BOB),
    });

    const slots = calculator.calculate({
      weeklyHours: {
        ...hours,
        mon: { start: '09:00', end: '12:00' },
      },
      durationMinutes: 45,
      from: new Date('2026-08-03T00:00:00.000Z'),
      to: new Date('2026-08-03T23:59:59.000Z'),
      appointments: [busy],
      blocks: [],
      timezone: 'UTC',
      slotStepMinutes: 15,
    });

    const morning = slots
      .map((s) => s.startsAt.toISOString())
      .filter((iso) => iso < '2026-08-03T10:00:00.000Z');

    expect(morning).toEqual([
      '2026-08-03T09:00:00.000Z',
      '2026-08-03T09:15:00.000Z',
    ]);
  });

  // The agent once offered a client 17:00, 18:00 and 19:00 on a Sunday for a 75 minute
  // treatment with a professional who works weekdays until 18:00. These pin down that the
  // schedule never produced any of those.
  describe('the Sunday the agent invented', () => {
    const camila: WeeklyHours = {
      mon: { start: '09:00', end: '18:00' },
      tue: { start: '09:00', end: '18:00' },
      wed: { start: '09:00', end: '18:00' },
      thu: { start: '09:00', end: '18:00' },
      fri: { start: '09:00', end: '18:00' },
      sat: { start: '09:00', end: '13:00' },
      sun: null,
    };
    const hidrafacialMinutes = 75;

    it('offers nothing on a day the professional does not work', () => {
      const slots = calculator.calculate({
        weeklyHours: camila,
        durationMinutes: hidrafacialMinutes,
        // Sunday 9 August 2026, whole day in La Paz.
        from: new Date('2026-08-09T04:00:00.000Z'),
        to: new Date('2026-08-10T03:59:59.000Z'),
        appointments: [],
        blocks: [],
        timezone: 'America/La_Paz',
      });

      expect(slots).toEqual([]);
    });

    it('stops offering once the treatment no longer fits before closing', () => {
      const slots = calculator.calculate({
        weeklyHours: camila,
        durationMinutes: hidrafacialMinutes,
        // Monday 10 August 2026, whole day in La Paz.
        from: new Date('2026-08-10T04:00:00.000Z'),
        to: new Date('2026-08-11T03:59:59.000Z'),
        appointments: [],
        blocks: [],
        timezone: 'America/La_Paz',
      });

      // 16:45 + 75 minutes lands exactly on the 18:00 close; 17:00 would run past it.
      expect(slots.at(-1)?.startsAt.toISOString()).toBe(
        '2026-08-10T20:45:00.000Z',
      );
      expect(
        calculator.isSlotAvailable({
          startsAt: new Date('2026-08-10T21:00:00.000Z'),
          endsAt: new Date('2026-08-10T22:15:00.000Z'),
          weeklyHours: camila,
          appointments: [],
          blocks: [],
          timezone: 'America/La_Paz',
        }),
      ).toBe(false);
    });
  });

  // An empty slot list cannot tell a closed Sunday from a booked-out Monday, and the agent
  // ends up saying "no hay disponibilidad" to both.
  describe('why a day has nothing', () => {
    const camila: WeeklyHours = {
      mon: { start: '09:00', end: '18:00' },
      tue: { start: '09:00', end: '18:00' },
      wed: null,
      thu: null,
      fri: null,
      sat: null,
      sun: null,
    };

    const monday = {
      from: new Date('2026-08-10T04:00:00.000Z'),
      to: new Date('2026-08-11T03:59:59.000Z'),
    };

    function outcomeOf(
      input: Partial<Parameters<typeof calculator.calculateByDay>[0]>,
    ) {
      const [day] = calculator.calculateByDay({
        weeklyHours: camila,
        durationMinutes: 60,
        ...monday,
        appointments: [],
        blocks: [],
        timezone: 'America/La_Paz',
        slotStepMinutes: 60,
        ...input,
      });
      return day;
    }

    it('reports a day the professional does not work as closed', () => {
      const day = outcomeOf({
        from: new Date('2026-08-12T04:00:00.000Z'),
        to: new Date('2026-08-13T03:59:59.000Z'),
      });

      expect(day.outcome).toBe(DayOutcome.CLOSED);
      expect(day.lastStartThatFits).toBeNull();
    });

    it('separates a treatment that never fits from a day with no room left', () => {
      const day = outcomeOf({ durationMinutes: 600 });

      expect(day.outcome).toBe(DayOutcome.SERVICE_DOES_NOT_FIT);
      expect(day.lastStartThatFits).toBeNull();
    });

    it('reports a booked-out day, and still says when the last start would have been', () => {
      const allDay = new ScheduleBlock({
        id: 'b1',
        tenantId: 't1',
        professionalId: 'p1',
        startsAt: new Date('2026-08-10T13:00:00.000Z'),
        endsAt: new Date('2026-08-10T22:00:00.000Z'),
        reason: 'capacitacion',
      });

      const day = outcomeOf({ blocks: [allDay] });

      expect(day.outcome).toBe(DayOutcome.FULLY_BOOKED);
      // 17:00 local is the last start whose hour still ends by the 18:00 close.
      expect(day.lastStartThatFits?.toISOString()).toBe(
        '2026-08-10T21:00:00.000Z',
      );
    });

    it('reports a day lost to the booking lead time as too soon, not as booked out', () => {
      const day = outcomeOf({
        earliestStartAt: new Date('2026-08-11T00:00:00.000Z'),
      });

      expect(day.outcome).toBe(DayOutcome.TOO_SOON);
      expect(day.slots).toEqual([]);
    });

    it('offers the free slots when there are any', () => {
      const day = outcomeOf({});

      expect(day.outcome).toBe(DayOutcome.AVAILABLE);
      expect(day.slots.length).toBeGreaterThan(0);
    });
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
