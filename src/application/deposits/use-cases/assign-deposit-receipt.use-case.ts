import { Inject, Injectable } from '@nestjs/common';

import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TRANSACTION_PORT,
  TransactionPort,
} from '@domain/common/ports/transaction.port';
import { DepositReceiptNotFoundError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_RECEIPT_REPOSITORY,
  DepositReceiptRepository,
} from '@domain/deposits/repositories/deposit-receipt.repository';

@Injectable()
export class AssignDepositReceiptUseCase {
  constructor(
    @Inject(DEPOSIT_RECEIPT_REPOSITORY)
    private readonly receipts: DepositReceiptRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(TRANSACTION_PORT)
    private readonly transaction: TransactionPort,
    private readonly audit: AuditRecorder,
    private readonly agendaEvents: AgendaEventPublisher,
  ) {}

  async execute(input: {
    receiptId: string;
    appointmentId: string;
    source: 'automatic' | 'agent' | 'staff';
    consumeExpectationForConversationId?: string;
  }): Promise<void> {
    const now = this.clock.now();
    const result = await this.transaction.run(async () => {
      const receiptPreview = await this.receipts.findById(input.receiptId);
      if (!receiptPreview) {
        throw new DepositReceiptNotFoundError(input.receiptId);
      }

      const appointmentIds = [
        ...new Set(
          [input.appointmentId, receiptPreview.appointmentId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ].sort();
      const lockedAppointments = new Map<string, Appointment | null>();
      for (const appointmentId of appointmentIds) {
        lockedAppointments.set(
          appointmentId,
          await this.appointments.findByIdForUpdate(appointmentId),
        );
      }
      const receipt = await this.receipts.findByIdForUpdate(input.receiptId);
      if (!receipt) throw new DepositReceiptNotFoundError(input.receiptId);
      if (
        receipt.appointmentId &&
        !lockedAppointments.has(receipt.appointmentId)
      ) {
        lockedAppointments.set(
          receipt.appointmentId,
          await this.appointments.findByIdForUpdate(receipt.appointmentId),
        );
      }
      const appointment = lockedAppointments.get(input.appointmentId);
      if (!appointment || !appointment.belongsTo(receipt.clientId)) {
        throw new AppointmentNotFoundError(input.appointmentId);
      }
      const previousAppointmentId = receipt.appointmentId;
      if (previousAppointmentId === appointment.id) {
        return { appointment, receipt, previousAppointmentId };
      }

      const previousAppointment = previousAppointmentId
        ? lockedAppointments.get(previousAppointmentId)
        : null;
      if (previousAppointment) {
        previousAppointment.assertCanReceiveDepositReceipt();
      }
      appointment.assertCanReceiveDepositReceipt();

      const assigned = await this.receipts.assign({
        receiptId: receipt.id,
        appointmentId: appointment.id,
        supersededAt: now,
      });
      if (!assigned) throw new DepositReceiptNotFoundError(input.receiptId);
      if (input.consumeExpectationForConversationId) {
        await this.receipts.consumeExpectation({
          conversationId: input.consumeExpectationForConversationId,
          now,
        });
      }
      return { appointment, receipt, previousAppointmentId };
    });

    await this.audit.record({
      action: result.previousAppointmentId
        ? AuditAction.DEPOSIT_RECEIPT_REASSIGNED
        : AuditAction.DEPOSIT_RECEIPT_ATTACHED,
      entity: 'appointment',
      entityId: result.appointment.id,
      before: {
        receiptAppointmentId: result.previousAppointmentId,
      },
      after: {
        receiptId: result.receipt.id,
        source: input.source,
      },
    });
    await this.agendaEvents.changed();
  }
}
