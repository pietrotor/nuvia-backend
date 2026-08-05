import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { isDepositAtRisk } from '@domain/appointments/services/deposit-risk';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { RescheduleAppointmentDto } from '../dto/reschedule-appointment.dto';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';

export interface RescheduleAppointmentResult {
  appointment: Appointment;
  depositAtRisk: boolean;
}

@Injectable()
export class RescheduleAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    private readonly slotValidator: AppointmentSlotValidator,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  // restrictToClientId narrows the operation to a single client's appointments:
  // the agent may only reschedule the ones from the ongoing conversation.
  async execute(
    id: string,
    dto: RescheduleAppointmentDto,
    restrictToClientId?: string,
  ): Promise<RescheduleAppointmentResult> {
    const current = await this.appointmentRepository.findById(id);
    if (
      !current ||
      (restrictToClientId && !current.belongsTo(restrictToClientId))
    ) {
      throw new AppointmentNotFoundError(id);
    }

    const slot = await this.slotValidator.validate({
      serviceId: current.serviceId,
      professionalId: dto.professionalId ?? current.professionalId,
      startsAt: new Date(dto.startsAt),
      excludeAppointmentId: current.id,
    });

    const appointment = await this.appointmentRepository.save(
      current.rescheduleTo(slot.startsAt, slot.endsAt, slot.professional.id),
    );

    await this.audit.record({
      action: AuditAction.APPOINTMENT_RESCHEDULED,
      entity: 'appointment',
      entityId: appointment.id,
      before: {
        professionalId: current.professionalId,
        startsAt: current.startsAt,
      },
      after: {
        professionalId: appointment.professionalId,
        startsAt: appointment.startsAt,
      },
    });

    return {
      appointment,
      depositAtRisk: isDepositAtRisk({
        appointment: current,
        service: slot.service,
        config: slot.config,
        now: this.clock.now(),
      }),
    };
  }
}
