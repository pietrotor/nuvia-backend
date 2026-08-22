import { AppointmentNotificationDelivery } from './appointment-notification-delivery.entity';
import { AppointmentNotificationDeliveryStatus } from '../value-objects/appointment-notification-delivery-status.vo';

const pending = () =>
  new AppointmentNotificationDelivery({
    id: 'd1',
    tenantId: 't1',
    eventId: 'e1',
    contactId: 'c1',
    destinationPhoneE164: '+59171234567',
    renderedContent: 'aviso',
    status: AppointmentNotificationDeliveryStatus.PENDING,
    attemptCount: 0,
    nextAttemptAt: new Date('2026-08-18T12:00:00.000Z'),
    leaseUntil: null,
    providerMessageId: null,
    acceptedAt: null,
    deliveredAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastError: null,
  });

describe('AppointmentNotificationDelivery', () => {
  it('does not retry unknown or failed provider outcomes', () => {
    const now = new Date('2026-08-18T12:01:00.000Z');
    const unknown = pending().markUnknown({ now, lastError: 'timeout' });
    const failed = pending().markFailed({
      now,
      lastErrorCode: 'whatsapp_463',
      lastError: '463',
    });

    expect(unknown.isOpen()).toBe(false);
    expect(unknown.status).toBe(AppointmentNotificationDeliveryStatus.UNKNOWN);
    expect(failed.isOpen()).toBe(false);
  });
});
