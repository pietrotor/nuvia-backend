import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  DepositReceiptClassification,
  DepositReceiptSource,
} from '@domain/deposits/entities/deposit-receipt.entity';
import { AssignDepositReceiptUseCase } from './assign-deposit-receipt.use-case';
import {
  DepositReceiptImage,
  ReceiveDepositReceiptUseCase,
} from './receive-deposit-receipt.use-case';

export type { DepositReceiptImage } from './receive-deposit-receipt.use-case';

@Injectable()
export class AttachDepositReceiptUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    private readonly receiveReceipt: ReceiveDepositReceiptUseCase,
    private readonly assignReceipt: AssignDepositReceiptUseCase,
  ) {}

  async execute(input: {
    appointmentId: string;
    image: DepositReceiptImage;
    providerMessageId?: string | null;
    conversationId?: string | null;
    receivedAt: Date;
    source?: DepositReceiptSource;
    classification?: DepositReceiptClassification;
  }): Promise<Appointment> {
    const appointment = await this.appointments.findById(input.appointmentId);
    if (!appointment) throw new AppointmentNotFoundError(input.appointmentId);
    const receipt = await this.receiveReceipt.execute({
      conversationId: input.conversationId ?? null,
      clientId: appointment.bookingContactClientId,
      image: input.image,
      providerMessageId: input.providerMessageId ?? null,
      receivedAt: input.receivedAt,
      source: input.source ?? DepositReceiptSource.STAFF,
      classification:
        input.classification ?? DepositReceiptClassification.STAFF_UPLOAD,
    });
    await this.assignReceipt.execute({
      receiptId: receipt.id,
      appointmentId: appointment.id,
      source: input.providerMessageId ? 'automatic' : 'staff',
    });
    const saved = await this.appointments.findById(appointment.id);
    if (!saved) throw new AppointmentNotFoundError(appointment.id);
    return saved;
  }
}
