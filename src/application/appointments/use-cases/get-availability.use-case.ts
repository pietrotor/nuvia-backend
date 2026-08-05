import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import {
  AvailabilityCalculator,
  TimeSlot,
} from '@domain/appointments/services/availability-calculator';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { GetAvailabilityDto } from '../dto/get-availability.dto';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';

@Injectable()
export class GetAvailabilityUseCase {
  private readonly availability = new AvailabilityCalculator();

  constructor(
    private readonly scheduleContext: ScheduleContextResolver,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
  ) {}

  async execute(dto: GetAvailabilityDto): Promise<TimeSlot[]> {
    const context = await this.scheduleContext.resolve({
      serviceId: dto.serviceId,
      professionalId: dto.professionalId,
    });

    // Nothing is ever offered before the minimum lead time, even if requested.
    const requestedFrom = new Date(dto.from);
    const to = new Date(dto.to);
    const from =
      requestedFrom > context.earliestStartAt
        ? requestedFrom
        : context.earliestStartAt;
    if (to <= from) return [];

    const [appointments, blocks] = await Promise.all([
      this.appointmentRepository.findByProfessionalInRange({
        professionalId: context.professional.id,
        from,
        to,
      }),
      this.scheduleBlockRepository.findInRange(
        from,
        to,
        context.professional.id,
      ),
    ]);

    return this.availability.calculate({
      weeklyHours: context.weeklyHours,
      durationMinutes: context.service.durationMinutes,
      from,
      to,
      appointments,
      blocks,
      timezone: context.timezone,
    });
  }
}
