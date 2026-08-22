import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { ReceiptImageClassification } from '@domain/deposits/ports/receipt-image-classifier.port';
import { DepositReceiptStatus } from '@domain/deposits/entities/deposit-receipt.entity';
import { CaptureInboundDepositReceiptUseCase } from './capture-inbound-deposit-receipt.use-case';

const now = new Date('2026-08-21T16:00:00.000Z');
const image = {
  bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  mimeType: 'image/jpeg',
};

const view = (id: string, startsAt: string) => ({
  appointment: new Appointment({
    id,
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    bookingContactClientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date(startsAt),
    endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
    status: AppointmentStatus.PENDING_DEPOSIT,
    price: Money.of('150.00', Currency.BOB),
    depositAmount: Money.of('50.00', Currency.BOB),
  }),
  service: { name: 'Limpieza facial' },
});

describe('CaptureInboundDepositReceiptUseCase', () => {
  const build = (
    pending: ReturnType<typeof view>[],
    classification = ReceiptImageClassification.RECEIPT,
    botPaused = false,
  ) => {
    const appointmentViews = {
      findByClient: jest.fn().mockResolvedValue(pending),
      findById: jest.fn(),
    };
    const receipts = {
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
      consumeExpectation: jest.fn().mockResolvedValue(null),
      findExpectedAppointment: jest.fn().mockResolvedValue(null),
    };
    const classifier = {
      classify: jest.fn().mockResolvedValue(classification),
    };
    const messaging = {
      markAsRead: jest.fn(),
      downloadInboundMedia: jest.fn().mockResolvedValue(image),
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'out-1' }),
    };
    const receiveReceipt = {
      execute: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
    };
    const assignReceipt = { execute: jest.fn() };
    const messages = {
      recordIfNew: jest.fn(),
      hasReplyTo: jest.fn().mockResolvedValue(false),
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
    };
    const useCase = new CaptureInboundDepositReceiptUseCase(
      appointmentViews as never,
      receipts as never,
      classifier as never,
      messaging as never,
      messages as never,
      {
        findById: jest.fn().mockResolvedValue({ timezone: 'America/La_Paz' }),
      } as never,
      { now: () => now },
      { findById: jest.fn().mockResolvedValue({ botPaused }) } as never,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      receiveReceipt as never,
      assignReceipt as never,
    );
    return {
      useCase,
      messaging,
      classifier,
      attachReceipt: assignReceipt,
      appointments: receipts,
      appointmentViews,
      messages,
      receipts,
      receiveReceipt,
    };
  };
  const input = {
    tenantId: 't1',
    clientId: 'c1',
    conversationId: 'cv1',
    clientPhoneE164: '+59170000001',
    providerMessageId: 'in-1',
    occurredAt: now,
  };

  it('does not download or classify an image when no deposit is pending', async () => {
    const built = build([]);

    expect(await built.useCase.execute(input)).toBe('not_expected');
    expect(built.messaging.downloadInboundMedia).not.toHaveBeenCalled();
    expect(built.classifier.classify).not.toHaveBeenCalled();
    expect(built.attachReceipt.execute).not.toHaveBeenCalled();
  });

  it('rejects an image classified as unrelated without storing it', async () => {
    const built = build(
      [view('a1', '2026-08-22T16:00:00.000Z')],
      ReceiptImageClassification.NOT_RECEIPT,
    );

    expect(await built.useCase.execute(input)).toBe('rejected');
    expect(built.attachReceipt.execute).not.toHaveBeenCalled();
    expect(built.messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/no parece/i) }),
    );
  });

  it('stores ambiguously and asks instead of choosing the nearest appointment', async () => {
    const built = build(
      [
        view('other', '2026-08-23T16:00:00.000Z'),
        view('nearest', '2026-08-22T16:00:00.000Z'),
      ],
      ReceiptImageClassification.UNKNOWN,
    );

    expect(await built.useCase.execute(input)).toBe('pending_assignment');
    expect(built.attachReceipt.execute).not.toHaveBeenCalled();
    expect(built.messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/más de un turno[\s\S]*¿Para cuál/i),
      }),
    );
  });

  it('leaves the reply to the queued agent turn when text accompanied the image', async () => {
    const built = build([
      view('thursday', '2026-08-27T16:00:00.000Z'),
      view('friday', '2026-08-28T16:00:00.000Z'),
    ]);

    expect(
      await built.useCase.execute({
        ...input,
        deferAmbiguousReply: true,
      }),
    ).toBe('pending_assignment');
    expect(built.messaging.sendText).not.toHaveBeenCalled();
  });

  it('attaches silently while the conversation is handed off', async () => {
    const built = build(
      [view('a1', '2026-08-22T16:00:00.000Z')],
      ReceiptImageClassification.RECEIPT,
      true,
    );

    expect(await built.useCase.execute(input)).toBe('attached');
    expect(built.attachReceipt.execute).toHaveBeenCalled();
    expect(built.messaging.sendText).not.toHaveBeenCalled();
  });

  it('assigns an image to the appointment linked by the quoted QR', async () => {
    const built = build([
      view('thursday', '2026-08-27T16:00:00.000Z'),
      view('friday', '2026-08-28T16:00:00.000Z'),
    ]);
    built.messages.findByProviderMessageId.mockResolvedValue({
      relatedAppointmentId: 'friday',
    });

    expect(
      await built.useCase.execute({
        ...input,
        inReplyToProviderMessageId: 'qr-for-friday',
      }),
    ).toBe('attached');
    expect(built.attachReceipt.execute).toHaveBeenCalledWith({
      receiptId: 'receipt-1',
      appointmentId: 'friday',
      source: 'automatic',
      consumeExpectationForConversationId: 'cv1',
    });
  });

  it('does not fall through when a quoted QR appointment is not pending', async () => {
    const built = build([view('thursday', '2026-08-27T16:00:00.000Z')]);
    built.messages.findByProviderMessageId.mockResolvedValue({
      relatedAppointmentId: 'friday',
    });

    expect(
      await built.useCase.execute({
        ...input,
        inReplyToProviderMessageId: 'qr-for-friday',
      }),
    ).toBe('pending_assignment');
    expect(built.attachReceipt.execute).not.toHaveBeenCalled();
  });

  it('assigns the next image to the explicitly expected appointment', async () => {
    const built = build([
      view('thursday', '2026-08-27T16:00:00.000Z'),
      view('friday', '2026-08-28T16:00:00.000Z'),
    ]);
    built.receipts.findExpectedAppointment.mockResolvedValue('thursday');

    expect(await built.useCase.execute(input)).toBe('attached');
    expect(built.attachReceipt.execute).toHaveBeenCalledWith({
      receiptId: 'receipt-1',
      appointmentId: 'thursday',
      source: 'automatic',
      consumeExpectationForConversationId: 'cv1',
    });
  });

  it('does not consume an expectation when receipt storage fails', async () => {
    const built = build([
      view('thursday', '2026-08-27T16:00:00.000Z'),
      view('friday', '2026-08-28T16:00:00.000Z'),
    ]);
    built.receipts.findExpectedAppointment.mockResolvedValue('thursday');
    built.receiveReceipt.execute.mockRejectedValue(
      new Error('storage unavailable'),
    );

    await expect(built.useCase.execute(input)).rejects.toThrow(
      'storage unavailable',
    );
    expect(built.receipts.consumeExpectation).not.toHaveBeenCalled();
    expect(built.attachReceipt.execute).not.toHaveBeenCalled();
  });

  it('retries the acknowledgement after the receipt was already persisted', async () => {
    const duplicateView = view('a1', '2026-08-22T16:00:00.000Z');
    const built = build([]);
    built.appointments.findByProviderMessageId.mockResolvedValue({
      status: DepositReceiptStatus.ASSIGNED,
      appointmentId: duplicateView.appointment.id,
    });
    built.appointmentViews.findById.mockResolvedValue(duplicateView);

    expect(await built.useCase.execute(input)).toBe('attached');
    expect(built.messaging.downloadInboundMedia).not.toHaveBeenCalled();
    expect(built.messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/limpieza facial/i),
      }),
    );
  });

  it('retries the assignment question for a stored ambiguous receipt', async () => {
    const built = build([
      view('thursday', '2026-08-27T16:00:00.000Z'),
      view('friday', '2026-08-28T16:00:00.000Z'),
    ]);
    built.appointments.findByProviderMessageId.mockResolvedValue({
      status: DepositReceiptStatus.PENDING_ASSIGNMENT,
      appointmentId: null,
    });

    expect(await built.useCase.execute(input)).toBe('pending_assignment');
    expect(built.messaging.downloadInboundMedia).not.toHaveBeenCalled();
    expect(built.messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/¿Para cuál/i) }),
    );
  });
});
