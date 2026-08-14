import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { InvalidAppointmentTransitionError } from '../exceptions/appointment.exceptions';
import { Appointment, AppointmentStatus } from './appointment.entity';

const build = (status: AppointmentStatus): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-05T15:00:00.000Z'),
    endsAt: new Date('2026-08-05T16:00:00.000Z'),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

describe('Appointment', () => {
  it('cancels an appointment with a pending deposit or a confirmed one', () => {
    expect(build(AppointmentStatus.PENDING_DEPOSIT).cancel().status).toBe(
      AppointmentStatus.CANCELLED,
    );
    expect(build(AppointmentStatus.CONFIRMED).cancel().status).toBe(
      AppointmentStatus.CANCELLED,
    );
  });

  it('does not cancel an appointment that is already closed', () => {
    expect(() => build(AppointmentStatus.CANCELLED).cancel()).toThrow(
      InvalidAppointmentTransitionError,
    );
    expect(() => build(AppointmentStatus.ATTENDED).cancel()).toThrow(
      InvalidAppointmentTransitionError,
    );
  });

  it('marks as attended only a confirmed appointment', () => {
    expect(build(AppointmentStatus.CONFIRMED).markAttended().status).toBe(
      AppointmentStatus.ATTENDED,
    );
    expect(() =>
      build(AppointmentStatus.PENDING_DEPOSIT).markAttended(),
    ).toThrow(InvalidAppointmentTransitionError);
  });

  it('marks as no-show only a confirmed appointment', () => {
    expect(build(AppointmentStatus.CONFIRMED).markNoShow().status).toBe(
      AppointmentStatus.NO_SHOW,
    );
    expect(() => build(AppointmentStatus.RELEASED).markNoShow()).toThrow(
      InvalidAppointmentTransitionError,
    );
  });

  it('reschedules without changing the status or mutating the original', () => {
    const original = build(AppointmentStatus.PENDING_DEPOSIT);
    const moved = original.rescheduleTo(
      new Date('2026-08-06T10:00:00.000Z'),
      new Date('2026-08-06T11:00:00.000Z'),
      { professionalId: 'p2' },
    );

    expect(moved.status).toBe(AppointmentStatus.PENDING_DEPOSIT);
    expect(moved.startsAt.toISOString()).toBe('2026-08-06T10:00:00.000Z');
    expect(moved.professionalId).toBe('p2');
    expect(original.startsAt.toISOString()).toBe('2026-08-05T15:00:00.000Z');
    expect(original.professionalId).toBe('p1');
  });

  it('does not reschedule an appointment that is already closed', () => {
    expect(() =>
      build(AppointmentStatus.NO_SHOW).rescheduleTo(
        new Date('2026-08-06T10:00:00.000Z'),
        new Date('2026-08-06T11:00:00.000Z'),
      ),
    ).toThrow(InvalidAppointmentTransitionError);
  });
});
