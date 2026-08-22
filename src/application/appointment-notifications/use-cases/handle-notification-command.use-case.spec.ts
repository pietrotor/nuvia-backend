import { hashActivationCode } from '../services/activation-code';
import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { AppointmentNotificationCopyPort } from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import { AppointmentNotificationDeliveryRepository } from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { NotificationContactRepository } from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { NotificationCommandKind } from '@domain/appointment-notifications/value-objects/notification-command.vo';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';
import { ClockPort } from '@domain/common/ports/clock.port';
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import { HandleNotificationCommandUseCase } from './handle-notification-command.use-case';

const now = new Date('2026-08-18T12:00:00.000Z');
const code = 'AB12CD';
const tenantId = 't1';

const pending = () =>
  new NotificationContact({
    id: 'c1',
    tenantId,
    displayName: 'Camila',
    phoneE164: '+59171234567',
    status: NotificationContactStatus.PENDING,
    activationCodeHash: hashActivationCode({ tenantId, code }),
    activationExpiresAt: new Date('2026-08-25T00:00:00.000Z'),
    activationProviderMessageId: null,
    activatedAt: null,
    pausedAt: null,
    deactivatedAt: null,
    lastInboundAt: null,
  });

describe('HandleNotificationCommandUseCase', () => {
  let contacts: jest.Mocked<
    Pick<NotificationContactRepository, 'findByPhone' | 'save'>
  >;
  let deliveries: jest.Mocked<
    Pick<AppointmentNotificationDeliveryRepository, 'cancelOpenForContact'>
  >;
  let messaging: jest.Mocked<Pick<MessagingPort, 'sendText'>>;
  let useCase: HandleNotificationCommandUseCase;

  beforeEach(() => {
    contacts = {
      findByPhone: jest.fn().mockResolvedValue(pending()),
      save: jest.fn((contact) => Promise.resolve(contact)),
    };
    deliveries = {
      cancelOpenForContact: jest.fn().mockResolvedValue(0),
    };
    messaging = {
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.out' }),
    };
    const copy: AppointmentNotificationCopyPort = {
      renderAlert: jest.fn(),
      handshakeReply: jest.fn().mockReturnValue('ok'),
    };
    const clock: ClockPort = { now: () => now };
    useCase = new HandleNotificationCommandUseCase(
      contacts as unknown as NotificationContactRepository,
      deliveries as unknown as AppointmentNotificationDeliveryRepository,
      copy,
      messaging as unknown as MessagingPort,
      clock,
    );
  });

  it('activates a pending contact with the matching code', async () => {
    const handled = await useCase.execute({
      tenantId,
      phoneE164: '+59171234567',
      providerMessageId: 'wamid.in',
      command: { kind: NotificationCommandKind.ACTIVATE, activationCode: code },
    });

    expect(handled).toBe(true);
    expect(contacts.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: NotificationContactStatus.ACTIVE }),
    );
    expect(messaging.sendText).toHaveBeenCalled();
  });

  it('swallows a wrong code without invoking the agent or activating', async () => {
    const handled = await useCase.execute({
      tenantId,
      phoneE164: '+59171234567',
      providerMessageId: 'wamid.in',
      command: {
        kind: NotificationCommandKind.ACTIVATE,
        activationCode: 'ZZZZZZ',
      },
    });

    expect(handled).toBe(true);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
  });

  it('opts out an active contact and cancels open deliveries', async () => {
    contacts.findByPhone.mockResolvedValue(
      pending().activate({ now, providerMessageId: 'wamid.1' }),
    );

    const handled = await useCase.execute({
      tenantId,
      phoneE164: '+59171234567',
      providerMessageId: 'wamid.stop',
      command: { kind: NotificationCommandKind.OPT_OUT },
    });

    expect(handled).toBe(true);
    expect(contacts.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: NotificationContactStatus.DEACTIVATED,
      }),
    );
    expect(deliveries.cancelOpenForContact).toHaveBeenCalledWith('c1', now);
  });

  it('lets a regular client conversation through when the phone is unknown', async () => {
    contacts.findByPhone.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId,
        phoneE164: '+59170000001',
        providerMessageId: 'wamid.hello',
        command: { kind: NotificationCommandKind.OPT_OUT },
      }),
    ).resolves.toBe(false);
    expect(contacts.save).not.toHaveBeenCalled();
  });
});
