import { Inject, Injectable } from '@nestjs/common';

import { ClientNameRequiredError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { ClientNotFoundError } from '@domain/clients/exceptions/client.exceptions';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { normalizeConfirmedClientName } from '@domain/clients/services/confirmed-client-name';

export interface ResolveBookingAttendeeInput {
  contactClientId: string;
  bookingForSelf: boolean;
  attendeeClientId?: string;
  attendeeName?: string;
}

@Injectable()
export class ResolveBookingAttendeeUseCase {
  constructor(
    @Inject(CLIENT_REPOSITORY)
    private readonly clientRepository: ClientRepository,
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViews: AppointmentViewRepository,
  ) {}

  async execute(input: ResolveBookingAttendeeInput): Promise<Client> {
    const contact = await this.clientRepository.findById(input.contactClientId);
    if (!contact) throw new ClientNotFoundError(input.contactClientId);
    if (!contact.hasConfirmedName()) throw new ClientNameRequiredError();

    if (input.bookingForSelf) {
      return contact;
    }

    if (!input.attendeeClientId && !input.attendeeName) {
      throw new ClientNameRequiredError();
    }

    if (input.attendeeClientId) {
      if (input.attendeeClientId === contact.id) return contact;
      const attendee = await this.clientRepository.findById(
        input.attendeeClientId,
      );
      if (!attendee) throw new ClientNotFoundError(input.attendeeClientId);
      if (!attendee.hasConfirmedName()) throw new ClientNameRequiredError();

      const known = await this.appointmentViews.findAttendeesBookedBy(
        contact.id,
      );
      if (!known.some((row) => row.id === attendee.id)) {
        throw new ClientNotFoundError(input.attendeeClientId);
      }
      return attendee;
    }

    const name = normalizeConfirmedClientName(input.attendeeName);
    if (!name) throw new ClientNameRequiredError();

    const known = await this.appointmentViews.findAttendeesBookedBy(contact.id);
    const reused = known.find(
      (row) =>
        row.name &&
        normalizeConfirmedClientName(row.name)?.toLocaleLowerCase('es-BO') ===
          name.toLocaleLowerCase('es-BO'),
    );
    if (reused) {
      const attendee = await this.clientRepository.findById(reused.id);
      if (!attendee) throw new ClientNotFoundError(reused.id);
      return attendee;
    }

    return this.clientRepository.create({
      name,
      phoneE164: null,
    });
  }
}
