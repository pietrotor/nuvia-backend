import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';

@Injectable()
export class MarkAppointmentNoShowUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string): Promise<Appointment> {
    const current = await this.appointmentRepository.findById(id);
    if (!current) throw new AppointmentNotFoundError(id);

    const appointment = await this.appointmentRepository.save(
      current.markNoShow(),
    );

    await this.audit.record({
      action: AuditAction.APPOINTMENT_NO_SHOW,
      entity: 'appointment',
      entityId: appointment.id,
      before: { status: current.status },
      after: { status: appointment.status },
    });

    return appointment;
  }
}
