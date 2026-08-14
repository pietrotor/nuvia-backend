import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';
import { BookAppointmentDto } from '../dto/book-appointment.dto';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';

@Injectable()
export class BookAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    private readonly slotValidator: AppointmentSlotValidator,
    private readonly audit: AuditRecorder,
    private readonly agendaEvents: AgendaEventPublisher,
  ) {}

  async execute(
    dto: BookAppointmentDto,
    actor: BookingActor = BookingActor.CLIENT,
  ): Promise<Appointment> {
    const client = await this.clientRepository.findById(dto.clientId);
    if (!client) throw new ClientNotFoundError(dto.clientId);

    const slot = await this.slotValidator.validate({
      serviceId: dto.serviceId,
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      startsAt: new Date(dto.startsAt),
      actor,
      durationMinutes: dto.durationMinutes,
    });

    const appointment = await this.appointmentRepository.create({
      branchId: slot.branch.id,
      clientId: client.id,
      professionalId: slot.professional.id,
      serviceId: slot.service.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: slot.service.requiresDeposit
        ? AppointmentStatus.PENDING_DEPOSIT
        : AppointmentStatus.CONFIRMED,
      price: slot.effectiveService.price.amount,
      currency: slot.effectiveService.price.currency,
      depositAmount: slot.effectiveService.depositAmount?.amount ?? null,
    });

    await this.audit.record({
      action: AuditAction.APPOINTMENT_BOOKED,
      entity: 'appointment',
      entityId: appointment.id,
      after: {
        branchId: appointment.branchId,
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
        startsAt: appointment.startsAt,
        status: appointment.status,
      },
    });

    await this.agendaEvents.changed();

    return appointment;
  }
}
