import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { ClientSummary } from '@domain/clients/views/client-summary';

@Injectable()
export class ListBookingAttendeesUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViews: AppointmentViewRepository,
  ) {}

  async execute(contactClientId: string): Promise<ClientSummary[]> {
    return this.appointmentViews.findAttendeesBookedBy(contactClientId);
  }
}
