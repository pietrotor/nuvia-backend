import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  DEPOSIT_RECEIPT_REPOSITORY,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';

const EXPECTATION_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ExpectDepositReceiptUseCase {
  constructor(
    @Inject(DEPOSIT_RECEIPT_REPOSITORY)
    private readonly receipts: DepositReceiptRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    conversationId: string;
    clientId: string;
    appointmentId: string;
  }): Promise<void> {
    const appointment = await this.appointments.findById(input.appointmentId);
    if (!appointment || !appointment.belongsTo(input.clientId)) {
      throw new AppointmentNotFoundError(input.appointmentId);
    }
    appointment.assertCanReceiveDepositReceipt();

    const now = this.clock.now();
    await this.receipts.expectNext({
      ...input,
      now,
      expiresAt: new Date(now.getTime() + EXPECTATION_TTL_MS),
    });
  }
}
