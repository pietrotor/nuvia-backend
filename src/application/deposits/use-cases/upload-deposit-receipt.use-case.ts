import { Inject, Injectable } from '@nestjs/common';

import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  AttachDepositReceiptUseCase,
  DepositReceiptImage,
} from './attach-deposit-receipt.use-case';

@Injectable()
export class UploadDepositReceiptUseCase {
  constructor(
    private readonly attachReceipt: AttachDepositReceiptUseCase,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async execute(
    appointmentId: string,
    image: DepositReceiptImage,
  ): Promise<Appointment> {
    return this.attachReceipt.execute({
      appointmentId,
      image,
      receivedAt: this.clock.now(),
    });
  }
}
