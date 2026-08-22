import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import {
  DepositReceipt,
  DepositReceiptClassification,
  DepositReceiptSource,
  DepositReceiptStatus,
} from '@domain/deposits/entities/deposit-receipt.entity';
import { AssignDepositReceiptUseCase } from './assign-deposit-receipt.use-case';

const appointment = (id: string, status: AppointmentStatus) =>
  new Appointment({
    id,
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    clientId: 'client-1',
    bookingContactClientId: 'client-1',
    professionalId: 'professional-1',
    serviceId: 'service-1',
    startsAt: new Date('2026-08-28T16:00:00.000Z'),
    endsAt: new Date('2026-08-28T17:00:00.000Z'),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

const receipt = (appointmentId: string | null) =>
  new DepositReceipt({
    id: 'receipt-1',
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    clientId: 'client-1',
    appointmentId,
    providerMessageId: 'provider-1',
    storageKey: 'receipt.jpg',
    mimeType: 'image/jpeg',
    receivedAt: new Date('2026-08-21T16:00:00.000Z'),
    status: appointmentId
      ? DepositReceiptStatus.ASSIGNED
      : DepositReceiptStatus.PENDING_ASSIGNMENT,
    source: DepositReceiptSource.WHATSAPP,
    classification: DepositReceiptClassification.RECEIPT,
  });

const build = (input: {
  receipt: DepositReceipt;
  appointments: Record<string, Appointment>;
}) => {
  const receipts = {
    findById: jest.fn().mockResolvedValue(input.receipt),
    findByIdForUpdate: jest.fn().mockResolvedValue(input.receipt),
    assign: jest.fn().mockResolvedValue(input.receipt),
    consumeExpectation: jest.fn().mockResolvedValue(null),
  };
  const appointments = {
    findByIdForUpdate: jest.fn((id: string) =>
      Promise.resolve(input.appointments[id] ?? null),
    ),
  };
  const useCase = new AssignDepositReceiptUseCase(
    receipts as never,
    appointments as never,
    { now: () => new Date('2026-08-21T17:00:00.000Z') },
    { run: (callback: () => Promise<unknown>) => callback() } as never,
    { record: jest.fn() } as never,
    { changed: jest.fn() } as never,
  );
  return { useCase, receipts };
};

describe('AssignDepositReceiptUseCase', () => {
  it('does not move evidence away from a confirmed appointment', async () => {
    const built = build({
      receipt: receipt('confirmed'),
      appointments: {
        confirmed: appointment('confirmed', AppointmentStatus.CONFIRMED),
        pending: appointment('pending', AppointmentStatus.PENDING_DEPOSIT),
      },
    });

    await expect(
      built.useCase.execute({
        receiptId: 'receipt-1',
        appointmentId: 'pending',
        source: 'agent',
      }),
    ).rejects.toThrow();
    expect(built.receipts.assign).not.toHaveBeenCalled();
  });

  it('assigns and consumes the expectation in one transaction', async () => {
    const built = build({
      receipt: receipt(null),
      appointments: {
        pending: appointment('pending', AppointmentStatus.PENDING_DEPOSIT),
      },
    });

    await built.useCase.execute({
      receiptId: 'receipt-1',
      appointmentId: 'pending',
      source: 'automatic',
      consumeExpectationForConversationId: 'conversation-1',
    });

    expect(built.receipts.assign).toHaveBeenCalled();
    expect(built.receipts.consumeExpectation).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      now: new Date('2026-08-21T17:00:00.000Z'),
    });
  });
});
