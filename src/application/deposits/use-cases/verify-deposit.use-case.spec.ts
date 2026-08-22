import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { OutboundClass } from '@domain/messaging/ports/messaging.port';
import { VerifyDepositUseCase } from './verify-deposit.use-case';

const now = new Date('2026-08-21T16:00:00.000Z');

const pendingAppointment = (): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    bookingContactClientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-22T16:00:00.000Z'),
    endsAt: new Date('2026-08-22T17:00:00.000Z'),
    status: AppointmentStatus.PENDING_DEPOSIT,
    price: Money.of('150.00', Currency.BOB),
    depositAmount: Money.of('50.00', Currency.BOB),
  });

describe('VerifyDepositUseCase', () => {
  it('confirms without requiring a receipt and schedules visit reminders', async () => {
    const appointments = {
      findById: jest.fn().mockResolvedValue(pendingAppointment()),
      saveDepositConfirmation: jest.fn((appointment: Appointment) =>
        Promise.resolve(appointment),
      ),
    };
    const reminders = { syncPreVisit: jest.fn() };
    const messaging = {
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'out-1' }),
    };
    const messages = { recordIfNew: jest.fn() };
    const useCase = new VerifyDepositUseCase(
      appointments as never,
      {
        findById: jest
          .fn()
          .mockResolvedValue({ id: 'c1', phoneE164: '+59170000001' }),
      } as never,
      {
        findByClientPhone: jest.fn().mockResolvedValue({ id: 'cv1' }),
      } as never,
      messages as never,
      messaging as never,
      { now: () => now },
      {
        tenantId: 't1',
        userId: 'user-1',
        runWithTenant: jest.fn(),
      },
      { run: (fn: () => unknown) => fn() } as never,
      { warn: jest.fn() } as never,
      reminders as never,
      { record: jest.fn() } as never,
      { changed: jest.fn() } as never,
    );

    const result = await useCase.execute('a1');

    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    expect(result.depositVerifiedByUserId).toBe('user-1');
    expect(reminders.syncPreVisit).toHaveBeenCalledWith(result);
    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        outboundClass: OutboundClass.TRANSACTIONAL,
        toE164: '+59170000001',
      }),
    );
    expect(messages.recordIfNew).toHaveBeenCalled();
  });
});
