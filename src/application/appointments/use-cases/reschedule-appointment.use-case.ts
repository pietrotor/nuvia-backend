import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { isDepositAtRisk } from '@domain/appointments/services/deposit-risk';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { RescheduleAppointmentDto } from '../dto/reschedule-appointment.dto';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';
import { minutesBetween } from '../services/resolve-appointment-duration';

export interface RescheduleAppointmentOptions {
  // Narrows the operation to a single client's appointments: the agent may only
  // reschedule the ones from the ongoing conversation.
  restrictToClientId?: string;
  actor?: BookingActor;
}

export interface RescheduleAppointmentResult {
  appointment: Appointment;
  depositAtRisk: boolean;
  // True when the effective seña at the new branch/slot differs from the snapshot.
  // Panel can flag for manual review; V1 does not auto-adjust verified deposits.
  depositRequiresReview: boolean;
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
    private readonly agendaEvents: AgendaEventPublisher,
  ) {}

  async execute(
    id: string,
    dto: RescheduleAppointmentDto,
    options: RescheduleAppointmentOptions = {},
  ): Promise<RescheduleAppointmentResult> {
    const { restrictToClientId, actor } = options;
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
      branchId: dto.branchId ?? current.branchId ?? undefined,
      startsAt: new Date(dto.startsAt),
      excludeAppointmentId: current.id,
      actor,
      durationMinutes: dto.durationMinutes,
      // Without a staff override the moved appointment keeps the length it already had,
      // instead of snapping back to whatever the service catalog says today.
      preserveDurationMinutes: minutesBetween(current.startsAt, current.endsAt),
    });

    const previousDeposit = current.depositAmount?.amount ?? null;
    const nextDeposit = slot.effectiveService.depositAmount?.amount ?? null;
    const depositRequiresReview = previousDeposit !== nextDeposit;

    const appointment = await this.appointmentRepository.save(
      current.rescheduleTo(slot.startsAt, slot.endsAt, {
        professionalId: slot.professional.id,
        branchId: slot.branch.id,
        price: slot.effectiveService.price,
        depositAmount: slot.effectiveService.depositAmount,
      }),
    );

    await this.audit.record({
      action: AuditAction.APPOINTMENT_RESCHEDULED,
      entity: 'appointment',
      entityId: appointment.id,
      before: {
        branchId: current.branchId,
        professionalId: current.professionalId,
        startsAt: current.startsAt,
        depositAmount: previousDeposit,
      },
      after: {
        branchId: appointment.branchId,
        professionalId: appointment.professionalId,
        startsAt: appointment.startsAt,
        depositAmount: nextDeposit,
      },
    });

    await this.agendaEvents.changed();

    return {
      appointment,
      depositAtRisk: isDepositAtRisk({
        appointment: current,
        service: slot.service,
        config: slot.config,
        now: this.clock.now(),
      }),
      depositRequiresReview,
    };
  }
}
