import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { AppointmentReminderPublisher } from '@application/reminders/services/appointment-reminder.publisher';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import {
  TRANSACTION_PORT,
  TransactionPort,
} from '@domain/common/ports/transaction.port';

@Injectable()
export class MarkAppointmentNoShowUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    private readonly audit: AuditRecorder,
    private readonly agendaEvents: AgendaEventPublisher,
    private readonly reminders: AppointmentReminderPublisher,
    @Inject(TRANSACTION_PORT)
    private readonly transactions: TransactionPort,
  ) {}

  async execute(id: string): Promise<Appointment> {
    const current = await this.appointmentRepository.findById(id);
    if (!current) throw new AppointmentNotFoundError(id);

    const appointment = await this.transactions.run(async () => {
      const noShow = await this.appointmentRepository.save(
        current.markNoShow(),
      );
      await this.reminders.cancelOpen(noShow.id);
      return noShow;
    });

    await this.audit.record({
      action: AuditAction.APPOINTMENT_NO_SHOW,
      entity: 'appointment',
      entityId: appointment.id,
      before: { status: current.status },
      after: { status: appointment.status },
    });

    await this.agendaEvents.changed();

    return appointment;
  }
}
