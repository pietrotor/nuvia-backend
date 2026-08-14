import { Inject, Injectable } from '@nestjs/common';

import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';

@Injectable()
export class GetAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViewRepository: AppointmentViewRepository,
  ) {}

  async execute(id: string): Promise<AppointmentView> {
    // The repository is tenant scoped, so an appointment of another business reads as
    // missing and the caller cannot tell one case from the other.
    const view = await this.appointmentViewRepository.findById(id);
    if (!view) throw new AppointmentNotFoundError(id);

    return view;
  }
}
