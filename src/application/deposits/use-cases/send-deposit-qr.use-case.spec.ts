import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { MessageKind } from '@domain/conversations/entities/message.entity';
import { MessageRepository } from '@domain/conversations/repositories/message.repository';
import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import { DepositQrRepository } from '@domain/deposits/repositories/deposit-qr.repository';
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import {
  Service,
  ServiceProps,
} from '@domain/services/entities/service.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import { ObjectStoragePort } from '@domain/storage/ports/object-storage.port';
import { SendDepositQrUseCase } from './send-deposit-qr.use-case';

const now = new Date('2026-08-05T15:00:00.000Z');
const bytes = Buffer.from('qr-bytes');

const buildAppointment = (status = AppointmentStatus.PENDING_DEPOSIT) =>
  new Appointment({
    id: 'ap1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-07T14:00:00.000Z'),
    endsAt: new Date('2026-08-07T15:00:00.000Z'),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

const buildService = (overrides: Partial<ServiceProps> = {}) =>
  new Service({
    id: 's1',
    tenantId: 't1',
    name: 'Hidrafacial',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '250.00',
    requiresDeposit: true,
    depositAmount: '50.00',
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: ['p1'],
    ...overrides,
  });

const buildDepositQr = (id = 'qr1', isDefault = true) =>
  new DepositQr({
    id,
    tenantId: 't1',
    label: `QR ${id}`,
    storageKey: `tenants/t1/deposit-qrs/${id}.png`,
    mimeType: 'image/png',
    sizeBytes: bytes.length,
    isDefault,
    isActive: true,
  });

describe('SendDepositQrUseCase', () => {
  let appointments: jest.Mocked<Pick<AppointmentRepository, 'findById'>>;
  let services: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let depositQrs: jest.Mocked<Pick<DepositQrRepository, 'findAll'>>;
  let messages: jest.Mocked<Pick<MessageRepository, 'recordIfNew'>>;
  let storage: jest.Mocked<Pick<ObjectStoragePort, 'get'>>;
  let messaging: jest.Mocked<Pick<MessagingPort, 'sendMedia'>>;
  let logger: jest.Mocked<LoggerPort>;
  let useCase: SendDepositQrUseCase;

  const input = {
    appointmentId: 'ap1',
    conversationId: 'cv1',
    clientPhoneE164: '+59170000001',
  };

  beforeEach(() => {
    appointments = {
      findById: jest.fn().mockResolvedValue(buildAppointment()),
    };
    services = { findById: jest.fn().mockResolvedValue(buildService()) };
    depositQrs = { findAll: jest.fn().mockResolvedValue([buildDepositQr()]) };
    messages = { recordIfNew: jest.fn().mockResolvedValue(null) };
    storage = {
      get: jest.fn().mockResolvedValue({ body: bytes, contentType: null }),
    };
    messaging = {
      sendMedia: jest.fn().mockResolvedValue({ providerMessageId: 'wamid.qr' }),
    };
    logger = { error: jest.fn(), warn: jest.fn() };
    const clock: ClockPort = { now: () => now };
    const branchServices = {
      findByBranchAndService: jest.fn().mockResolvedValue(null),
    };

    useCase = new SendDepositQrUseCase(
      appointments as unknown as AppointmentRepository,
      services as unknown as ServiceRepository,
      branchServices as never,
      depositQrs as unknown as DepositQrRepository,
      messages as unknown as MessageRepository,
      storage as unknown as ObjectStoragePort,
      messaging as unknown as MessagingPort,
      clock,
      logger,
    );
  });

  it('sends the bytes so the flow works on any storage driver', async () => {
    const result = await useCase.execute(input);

    expect(result).toEqual({ outcome: 'sent', amount: 'Bs 50' });
    expect(messaging.sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        toE164: '+59170000001',
        media: { source: 'bytes', bytes },
        mimeType: 'image/png',
      }),
    );
  });

  it('states the amount in the caption and stores it as the sent image', async () => {
    await useCase.execute(input);

    const caption = messaging.sendMedia.mock.calls[0][0].caption;
    expect(caption).toContain('Bs 50');
    expect(caption).toContain('Hidrafacial');
    expect(messages.recordIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'cv1',
        providerMessageId: 'wamid.qr',
        kind: MessageKind.IMAGE,
        content: caption,
      }),
    );
  });

  it('turns a percentage into the amount the client transfers', async () => {
    services.findById.mockResolvedValue(
      buildService({ depositAmount: null, depositPercent: 30 }),
    );

    await useCase.execute(input);

    expect(messaging.sendMedia.mock.calls[0][0].caption).toContain('Bs 75');
  });

  it('asks for no money once the appointment left pending deposit', async () => {
    appointments.findById.mockResolvedValue(
      buildAppointment(AppointmentStatus.CONFIRMED),
    );

    const result = await useCase.execute(input);

    expect(result.outcome).toBe('not_pending_deposit');
    expect(messaging.sendMedia).not.toHaveBeenCalled();
  });

  it('sends the QR the service points at instead of the default', async () => {
    services.findById.mockResolvedValue(buildService({ depositQrId: 'qr2' }));
    depositQrs.findAll.mockResolvedValue([
      buildDepositQr(),
      buildDepositQr('qr2', false),
    ]);

    await useCase.execute(input);

    expect(storage.get).toHaveBeenCalledWith('tenants/t1/deposit-qrs/qr2.png');
  });

  it('warns the owner instead of the client when there is no QR to charge with', async () => {
    depositQrs.findAll.mockResolvedValue([]);

    const result = await useCase.execute(input);

    expect(result).toEqual({ outcome: 'no_qr_configured', amount: 'Bs 50' });
    expect(messaging.sendMedia).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('prefers the content type the storage reports over the recorded one', async () => {
    storage.get.mockResolvedValue({ body: bytes, contentType: 'image/webp' });

    await useCase.execute(input);

    expect(messaging.sendMedia.mock.calls[0][0].mimeType).toBe('image/webp');
  });
});
