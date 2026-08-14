import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { ValidationError } from '@domain/common/exceptions';

import {
  minutesBetween,
  resolveAppointmentDuration,
} from './resolve-appointment-duration';

describe('resolveAppointmentDuration', () => {
  it('uses the service catalog for clients', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 60,
        actor: BookingActor.CLIENT,
        durationMinutes: 45,
      }),
    ).toBe(60);
  });

  it('lets staff override the catalog', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 60,
        actor: BookingActor.STAFF,
        durationMinutes: 45,
      }),
    ).toBe(45);
  });

  it('preserves the current span when staff reschedules without an override', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 60,
        actor: BookingActor.STAFF,
        preserveDurationMinutes: 45,
      }),
    ).toBe(45);
  });

  it('prefers a staff override over the preserved span', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 60,
        actor: BookingActor.STAFF,
        durationMinutes: 90,
        preserveDurationMinutes: 45,
      }),
    ).toBe(90);
  });

  it('takes the catalog length back even when the service is off the grid', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 20,
        actor: BookingActor.STAFF,
        durationMinutes: 20,
        preserveDurationMinutes: 45,
      }),
    ).toBe(20);
  });

  it('keeps an off-grid span that was already booked', () => {
    expect(
      resolveAppointmentDuration({
        serviceDurationMinutes: 20,
        actor: BookingActor.STAFF,
        preserveDurationMinutes: 20,
      }),
    ).toBe(20);
  });

  it('rejects a staff override that is not on the 15-minute grid', () => {
    expect(() =>
      resolveAppointmentDuration({
        serviceDurationMinutes: 60,
        actor: BookingActor.STAFF,
        durationMinutes: 40,
      }),
    ).toThrow(ValidationError);
  });
});

describe('minutesBetween', () => {
  it('rounds the interval to whole minutes', () => {
    expect(
      minutesBetween(
        new Date('2026-08-05T15:00:00.000Z'),
        new Date('2026-08-05T15:45:00.000Z'),
      ),
    ).toBe(45);
  });
});
