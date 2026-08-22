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
import { ClientNameRequiredError } from '@domain/appointments/exceptions/appointment.exceptions';
import { collectBookingAnswers } from '@domain/appointments/services/collect-booking-answers';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';
import { BookAppointmentDto } from '../dto/book-appointment.dto';
import { AppointmentSlotValidator } from '../services/appointment-slot-validator.service';
import { AppointmentNotificationPublisher } from '@application/appointment-notifications/services/appointment-notification.publisher';
import { AppointmentReminderPublisher } from '@application/reminders/services/appointment-reminder.publisher';
import {
  TRANSACTION_PORT,
  TransactionPort,
} from '@domain/common/ports/transaction.port';

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
    private readonly notifications: AppointmentNotificationPublisher,
    private readonly reminders: AppointmentReminderPublisher,
    @Inject(TRANSACTION_PORT)
    private readonly transactions: TransactionPort,
  ) {}

  async execute(
    dto: BookAppointmentDto,
    actor: BookingActor = BookingActor.CLIENT,
  ): Promise<Appointment> {
    const attendee = await this.clientRepository.findById(dto.clientId);
    if (!attendee) throw new ClientNotFoundError(dto.clientId);
    if (!attendee.hasConfirmedName()) throw new ClientNameRequiredError();

    const contactId = dto.bookingContactClientId ?? dto.clientId;
    const contact =
      contactId === attendee.id
        ? attendee
        : await this.clientRepository.findById(contactId);
    if (!contact) throw new ClientNotFoundError(contactId);

    const slot = await this.slotValidator.validate({
      serviceId: dto.serviceId,
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      startsAt: new Date(dto.startsAt),
      actor,
      durationMinutes: dto.durationMinutes,
    });

    const bookingAnswers = collectBookingAnswers(
      slot.service.bookingQuestions,
      dto.answers ?? [],
    );

    const appointment = await this.transactions.run(async () => {
      const created = await this.appointmentRepository.create({
        branchId: slot.branch.id,
        clientId: attendee.id,
        bookingContactClientId: contact.id,
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
        bookingAnswers,
      });
      await this.notifications.recordBooked(created);
      await this.reminders.syncPreVisit(created);
      return created;
    });

    await this.audit.record({
      action: AuditAction.APPOINTMENT_BOOKED,
      entity: 'appointment',
      entityId: appointment.id,
      after: {
        branchId: appointment.branchId,
        clientId: appointment.clientId,
        bookingContactClientId: appointment.bookingContactClientId,
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
