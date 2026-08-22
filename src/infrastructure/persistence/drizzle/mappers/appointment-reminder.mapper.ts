import { AppointmentReminder } from '@domain/reminders/entities/appointment-reminder.entity';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { AppointmentReminderStatus } from '@domain/reminders/value-objects/appointment-reminder-status.vo';
import { AppointmentReminderSchema } from '../schema/appointment-reminder.schema';

export class AppointmentReminderMapper {
  static toDomain(row: AppointmentReminderSchema): AppointmentReminder {
    return new AppointmentReminder({
      id: row.id,
      tenantId: row.tenantId,
      appointmentId: row.appointmentId,
      kind: row.kind as AppointmentReminderKind,
      destinationPhoneE164: row.destinationPhoneE164,
      renderedContent: row.renderedContent,
      status: row.status as AppointmentReminderStatus,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      leaseUntil: row.leaseUntil,
      providerMessageId: row.providerMessageId,
      acceptedAt: row.acceptedAt,
      failedAt: row.failedAt,
      lastErrorCode: row.lastErrorCode,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
