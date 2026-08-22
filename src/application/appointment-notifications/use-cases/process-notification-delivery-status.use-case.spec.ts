import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import { AppointmentNotificationDeliveryRepository } from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { ClockPort } from '@domain/common/ports/clock.port';
import { OutboundSafetyPort } from '@domain/messaging/ports/outbound-safety.port';
import { ProcessNotificationDeliveryStatusUseCase } from './process-notification-delivery-status.use-case';

const now = new Date('2026-08-18T12:05:00.000Z');

const accepted = () =>
  new AppointmentNotificationDelivery({
    id: 'd1',
    tenantId: 't1',
    eventId: 'e1',
    contactId: 'c1',
    destinationPhoneE164: '+59171234567',
    renderedContent: 'aviso',
    status: AppointmentNotificationDeliveryStatus.ACCEPTED,
    attemptCount: 1,
    nextAttemptAt: now,
    leaseUntil: null,
    providerMessageId: 'wamid.out',
    acceptedAt: now,
    deliveredAt: null,
    failedAt: null,
    lastErrorCode: null,
    lastError: null,
  });

describe('ProcessNotificationDeliveryStatusUseCase', () => {
  let deliveries: jest.Mocked<
    Pick<
      AppointmentNotificationDeliveryRepository,
      'findByProviderMessageId' | 'save'
    >
  >;
  let outboundSafety: jest.Mocked<Pick<OutboundSafetyPort, 'openBreaker'>>;
  let useCase: ProcessNotificationDeliveryStatusUseCase;

  beforeEach(() => {
    deliveries = {
      findByProviderMessageId: jest.fn().mockResolvedValue(accepted()),
      save: jest.fn((delivery) => Promise.resolve(delivery)),
    };
    outboundSafety = { openBreaker: jest.fn().mockResolvedValue(undefined) };
    const clock: ClockPort = { now: () => now };
    useCase = new ProcessNotificationDeliveryStatusUseCase(
      deliveries as unknown as AppointmentNotificationDeliveryRepository,
      outboundSafety as unknown as OutboundSafetyPort,
      clock,
    );
  });

  it('marks a MESSAGES_UPDATE delivery as delivered', async () => {
    await useCase.execute({
      providerMessageId: 'wamid.out',
      status: 'DELIVERY_ACK',
    });

    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.DELIVERED,
      }),
    );
  });

  it('opens the tenant breaker and does not retry after a 463', async () => {
    await useCase.execute({
      providerMessageId: 'wamid.out',
      status: 'ERROR',
      statusCode: 463,
    });

    expect(outboundSafety.openBreaker).toHaveBeenCalledWith('t1');
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AppointmentNotificationDeliveryStatus.FAILED,
        lastErrorCode: 'whatsapp_463',
      }),
    );
  });

  it('ignores status updates for other WhatsApp traffic', async () => {
    deliveries.findByProviderMessageId.mockResolvedValue(null);

    await useCase.execute({
      providerMessageId: 'wamid.client',
      status: 'DELIVERY_ACK',
    });

    expect(deliveries.save).not.toHaveBeenCalled();
    expect(outboundSafety.openBreaker).not.toHaveBeenCalled();
  });
});
