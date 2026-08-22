import { AppointmentNotificationEvent } from '../entities/appointment-notification-event.entity';
import { AppointmentSlotSnapshot } from '../value-objects/appointment-slot-snapshot.vo';
import { AppointmentNotificationKind } from '../value-objects/appointment-notification-kind.vo';

export interface CreateAppointmentNotificationEventData {
  appointmentId: string;
  kind: AppointmentNotificationKind;
  previous: AppointmentSlotSnapshot | null;
  current: AppointmentSlotSnapshot;
  occurredAt: Date;
  nextAttemptAt: Date;
}

export interface AppointmentNotificationEventRepository {
  create(
    data: CreateAppointmentNotificationEventData,
  ): Promise<AppointmentNotificationEvent>;
  save(
    event: AppointmentNotificationEvent,
  ): Promise<AppointmentNotificationEvent>;
  findById(id: string): Promise<AppointmentNotificationEvent | null>;
  findUnexpandedDue(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationEvent[]>;
  findUnexpandedDueUnscoped(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationEvent[]>;
  findLaterForAppointment(input: {
    appointmentId: string;
    afterSequence: number;
  }): Promise<AppointmentNotificationEvent[]>;
}

export const APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY =
  'AppointmentNotificationEventRepository';
