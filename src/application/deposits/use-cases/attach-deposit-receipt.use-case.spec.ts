import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { AttachDepositReceiptUseCase } from './attach-deposit-receipt.use-case';

const appointment = (): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-22T16:00:00.000Z'),
    endsAt: new Date('2026-08-22T17:00:00.000Z'),
    status: AppointmentStatus.PENDING_DEPOSIT,
    price: Money.of('150.00', Currency.BOB),
    depositReceipt: {
      storageKey: 'tenants/t1/deposit-receipts/a1/old.jpg',
      mimeType: 'image/jpeg',
      receivedAt: new Date('2026-08-21T15:00:00.000Z'),
      providerMessageId: 'old-message',
    },
  });

describe('AttachDepositReceiptUseCase', () => {
  it('stores and assigns a replacement without deleting receipt history', async () => {
    const saved = appointment().attachReceipt({
      id: 'receipt-new',
      storageKey: 'new.jpg',
      mimeType: 'image/jpeg',
      receivedAt: new Date('2026-08-21T16:00:00.000Z'),
      providerMessageId: 'new-message',
    });
    const appointments = {
      findById: jest
        .fn()
        .mockResolvedValueOnce(appointment())
        .mockResolvedValueOnce(saved),
    };
    const receiveReceipt = {
      execute: jest.fn().mockResolvedValue({
        id: 'receipt-new',
      }),
    };
    const assignReceipt = { execute: jest.fn().mockResolvedValue(undefined) };
    const useCase = new AttachDepositReceiptUseCase(
      appointments as never,
      receiveReceipt as never,
      assignReceipt as never,
    );

    const result = await useCase.execute({
      appointmentId: 'a1',
      image: {
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        mimeType: 'image/jpeg',
      },
      providerMessageId: 'new-message',
      receivedAt: new Date('2026-08-21T16:00:00.000Z'),
    });

    expect(receiveReceipt.execute).toHaveBeenCalled();
    expect(assignReceipt.execute).toHaveBeenCalledWith({
      receiptId: 'receipt-new',
      appointmentId: 'a1',
      source: 'automatic',
    });
    expect(result.depositReceipt?.providerMessageId).toBe('new-message');
  });

  it('returns the current appointment after an idempotent assignment', async () => {
    const existing = appointment();
    const appointments = { findById: jest.fn().mockResolvedValue(existing) };
    const receiveReceipt = {
      execute: jest.fn().mockResolvedValue({ id: 'receipt-old' }),
    };
    const assignReceipt = { execute: jest.fn().mockResolvedValue(undefined) };
    const useCase = new AttachDepositReceiptUseCase(
      appointments as never,
      receiveReceipt as never,
      assignReceipt as never,
    );

    const result = await useCase.execute({
      appointmentId: 'a1',
      image: {
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        mimeType: 'image/jpeg',
      },
      providerMessageId: 'old-message',
      receivedAt: new Date('2026-08-21T15:00:00.000Z'),
    });

    expect(result).toBe(existing);
    expect(assignReceipt.execute).toHaveBeenCalled();
  });
});
