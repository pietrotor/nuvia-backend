import { Inject, Injectable } from '@nestjs/common';

import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { AppointmentSlotSnapshot } from '@domain/appointment-notifications/value-objects/appointment-slot-snapshot.vo';
import {
  APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
  AppointmentNotificationEventRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { NOTIFICATION_COALESCE_DELAY_MS } from '@domain/appointment-notifications/services/notification-limits';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

@Injectable()
export class AppointmentNotificationPublisher {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY)
    private readonly events: AppointmentNotificationEventRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  recordBooked(appointment: Appointment): Promise<void> {
    return this.record({
      appointment,
      kind: AppointmentNotificationKind.BOOKED,
      previous: null,
      current: this.snapshot(appointment),
    });
  }

  recordCancelled(appointment: Appointment): Promise<void> {
    return this.record({
      appointment,
      kind: AppointmentNotificationKind.CANCELLED,
      previous: null,
      current: this.snapshot(appointment),
    });
  }

  recordRescheduled(input: {
    previous: Appointment;
    current: Appointment;
  }): Promise<void> {
    return this.record({
      appointment: input.current,
      kind: AppointmentNotificationKind.RESCHEDULED,
      previous: this.snapshot(input.previous),
      current: this.snapshot(input.current),
    });
  }

  private async record(input: {
    appointment: Appointment;
    kind: AppointmentNotificationKind;
    previous: AppointmentSlotSnapshot | null;
    current: AppointmentSlotSnapshot;
  }): Promise<void> {
    const now = this.clock.now();
    await this.events.create({
      appointmentId: input.appointment.id,
      kind: input.kind,
      previous: input.previous,
      current: input.current,
      occurredAt: now,
      nextAttemptAt: new Date(now.getTime() + NOTIFICATION_COALESCE_DELAY_MS),
    });
  }

  private snapshot(appointment: Appointment): AppointmentSlotSnapshot {
    return {
      professionalId: appointment.professionalId,
      branchId: appointment.branchId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
    };
  }
}
