import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { ErrorCode, ValidationError } from '@domain/common/exceptions';

/** Grid step of the panel agenda: overrides must land on the same rhythm. */
export const APPOINTMENT_DURATION_STEP_MINUTES = 15;

/** Longest appointment the panel may book without inventing a new catalogue entry. */
export const APPOINTMENT_DURATION_MAX_MINUTES = 8 * 60;

export interface ResolveAppointmentDurationInput {
  /** Catalog default for the service being booked. */
  serviceDurationMinutes: number;
  actor?: BookingActor;
  /**
   * Staff-only override from the panel. Ignored for CLIENT (agent / public page):
   * those surfaces always book the catalog length.
   */
  durationMinutes?: number;
  /**
   * Span of the appointment being moved. Used on reschedule when staff does not
   * send a new override, so a custom length is not reset to the catalog.
   */
  preserveDurationMinutes?: number;
}

/**
 * Who decides how long the slot lasts: staff may shorten or stretch it; everyone
 * else gets the service duration. A reschedule without an override keeps the
 * length the appointment already had.
 */
export const resolveAppointmentDuration = (
  input: ResolveAppointmentDurationInput,
): number => {
  const actor = input.actor ?? BookingActor.CLIENT;

  if (
    actor === BookingActor.STAFF &&
    input.durationMinutes !== undefined &&
    input.durationMinutes !== null
  ) {
    // The catalog length always goes through, even for a service that does not sit on
    // the grid: the panel is repeating what the service says, not inventing a span, and
    // refusing it would leave a 20-minute service impossible to book back to normal.
    if (input.durationMinutes === input.serviceDurationMinutes) {
      return input.durationMinutes;
    }

    return assertValidDuration(input.durationMinutes);
  }

  // Already booked, so it is a fact and not a request: the grid does not judge it.
  if (
    input.preserveDurationMinutes !== undefined &&
    input.preserveDurationMinutes !== null
  ) {
    return input.preserveDurationMinutes;
  }

  return input.serviceDurationMinutes;
};

const assertValidDuration = (minutes: number): number => {
  if (
    !Number.isInteger(minutes) ||
    minutes < APPOINTMENT_DURATION_STEP_MINUTES ||
    minutes > APPOINTMENT_DURATION_MAX_MINUTES ||
    minutes % APPOINTMENT_DURATION_STEP_MINUTES !== 0
  ) {
    throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);
  }

  return minutes;
};

/** Minutes between two instants, rounded to the nearest minute. */
export const minutesBetween = (startsAt: Date, endsAt: Date): number =>
  Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
