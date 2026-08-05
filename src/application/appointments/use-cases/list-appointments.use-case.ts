import { Inject, Injectable } from '@nestjs/common';

import { ListAppointmentsDto } from '@application/appointments/dto/list-appointments.dto';
import { ScheduleContextResolver } from '@application/appointments/services/schedule-context-resolver.service';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { appointmentDateRangeIn } from '@domain/appointments/services/date-range';
import { ErrorCode, ValidationError } from '@domain/common/exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViewRepository: AppointmentViewRepository,
    private readonly scheduleContext: ScheduleContextResolver,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(dto: ListAppointmentsDto): Promise<AppointmentView[]> {
    const timezone = await this.scheduleContext.tenantTimezone();
    const range = appointmentDateRangeIn({
      from: dto.from,
      to: dto.to,
      now: this.clock.now(),
      timezone,
    });
    if (!range) throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);

    return this.appointmentViewRepository.findInRange({
      ...range,
      professionalId: dto.professionalId,
    });
  }
}
