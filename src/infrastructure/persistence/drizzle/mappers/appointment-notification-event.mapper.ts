import { AppointmentNotificationEvent } from '@domain/appointment-notifications/entities/appointment-notification-event.entity';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { AppointmentNotificationEventSchema } from '../schema/appointment-notification.schema';

export class AppointmentNotificationEventMapper {
  static toDomain(
    row: AppointmentNotificationEventSchema,
  ): AppointmentNotificationEvent {
    const previous =
      row.previousProfessionalId &&
      row.previousBranchId &&
      row.previousStartsAt &&
      row.previousEndsAt
        ? {
            professionalId: row.previousProfessionalId,
            branchId: row.previousBranchId,
            startsAt: row.previousStartsAt,
            endsAt: row.previousEndsAt,
          }
        : null;

    return new AppointmentNotificationEvent({
      id: row.id,
      tenantId: row.tenantId,
      appointmentId: row.appointmentId,
      sequence: row.sequence,
      kind: row.kind as AppointmentNotificationKind,
      previous,
      current: {
        professionalId: row.currentProfessionalId,
        branchId: row.currentBranchId,
        startsAt: row.currentStartsAt,
        endsAt: row.currentEndsAt,
      },
      occurredAt: row.occurredAt,
      expandedAt: row.expandedAt,
      attemptCount: row.attemptCount,
      nextAttemptAt: row.nextAttemptAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
