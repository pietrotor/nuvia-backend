import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import { DepositReceiptNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '@domain/storage/ports/object-storage.port';

export interface DepositReceiptImageBody {
  body: Buffer;
  mimeType: string;
}

@Injectable()
export class GetDepositReceiptImageUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(appointmentId: string): Promise<DepositReceiptImageBody> {
    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment) throw new AppointmentNotFoundError(appointmentId);
    if (!appointment.depositReceipt) {
      throw new DepositReceiptNotFoundError(appointmentId);
    }

    const stored = await this.storage.get(
      appointment.depositReceipt.storageKey,
    );
    return {
      body: stored.body,
      mimeType: stored.contentType ?? appointment.depositReceipt.mimeType,
    };
  }
}
