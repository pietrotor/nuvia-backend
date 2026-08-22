import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { AppointmentNotificationEventSchema } from '../schema/appointment-notification.schema';
import { AppointmentNotificationEventMapper } from './appointment-notification-event.mapper';

describe('AppointmentNotificationEventMapper', () => {
  it('maps a booked row without a previous snapshot', () => {
    const event = AppointmentNotificationEventMapper.toDomain({
      id: 'e1',
      tenantId: 't1',
      appointmentId: 'a1',
      sequence: 1,
      kind: 'booked',
      previousProfessionalId: null,
      previousBranchId: null,
      previousStartsAt: null,
      previousEndsAt: null,
      currentProfessionalId: 'p1',
      currentBranchId: 'b1',
      currentStartsAt: new Date('2026-08-18T18:00:00.000Z'),
      currentEndsAt: new Date('2026-08-18T19:00:00.000Z'),
      occurredAt: new Date('2026-08-18T12:00:00.000Z'),
      expandedAt: null,
      attemptCount: 0,
      nextAttemptAt: new Date('2026-08-18T12:01:15.000Z'),
      lastError: null,
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
      updatedAt: new Date('2026-08-18T12:00:00.000Z'),
    } as AppointmentNotificationEventSchema);

    expect(event.kind).toBe(AppointmentNotificationKind.BOOKED);
    expect(event.previous).toBeNull();
    expect(event.current.professionalId).toBe('p1');
  });
});
