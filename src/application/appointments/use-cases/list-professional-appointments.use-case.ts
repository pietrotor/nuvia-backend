import { Inject, Injectable } from '@nestjs/common';

import { ACTIVE_APPOINTMENT_STATUSES } from '@domain/appointments/entities/appointment.entity';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';

export interface ListProfessionalAppointmentsInput {
  professionalId: string;
  onlyUpcoming?: boolean;
}

@Injectable()
export class ListProfessionalAppointmentsUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViewRepository: AppointmentViewRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(
    input: ListProfessionalAppointmentsInput,
  ): Promise<AppointmentView[]> {
    const professional = await this.professionalRepository.findById(
      input.professionalId,
    );
    if (!professional) {
      throw new ProfessionalNotFoundError(input.professionalId);
    }

    return this.appointmentViewRepository.findByProfessional({
      professionalId: input.professionalId,
      statuses: input.onlyUpcoming ? ACTIVE_APPOINTMENT_STATUSES : undefined,
      from: input.onlyUpcoming ? this.clock.now() : undefined,
    });
  }
}
