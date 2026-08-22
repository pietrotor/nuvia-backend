import { Inject, Injectable } from '@nestjs/common';

import { ACTIVE_APPOINTMENT_STATUSES } from '@domain/appointments/entities/appointment.entity';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
  ClientAppointmentScope,
} from '@domain/appointments/repositories/appointment-view.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

export interface ListClientAppointmentsInput {
  clientId: string;
  onlyUpcoming?: boolean;
  scope?: ClientAppointmentScope;
}

@Injectable()
export class ListClientAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViewRepository: AppointmentViewRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ListClientAppointmentsInput,
  ): Promise<AppointmentView[]> {
    return this.appointmentViewRepository.findByClient({
      clientId: input.clientId,
      statuses: input.onlyUpcoming ? ACTIVE_APPOINTMENT_STATUSES : undefined,
      from: input.onlyUpcoming ? this.clock.now() : undefined,
      scope: input.scope,
    });
  }
}
