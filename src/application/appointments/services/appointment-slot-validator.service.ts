import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { AvailabilityCalculator } from '@domain/appointments/services/availability-calculator';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import {
  ScheduleContext,
  ScheduleContextResolver,
} from './schedule-context-resolver.service';

export interface ValidateSlotInput {
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  excludeAppointmentId?: string;
}

export interface ValidatedSlot extends ScheduleContext {
  startsAt: Date;
  endsAt: Date;
}

// The only schedule validation path: booking and rescheduling use it, and through
// them the agent, the panel and the public booking page.
@Injectable()
export class AppointmentSlotValidator {
  private readonly availability = new AvailabilityCalculator();

  constructor(
    private readonly scheduleContext: ScheduleContextResolver,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
  ) {}

  async validate(input: ValidateSlotInput): Promise<ValidatedSlot> {
    const context = await this.scheduleContext.resolve({
      serviceId: input.serviceId,
      professionalId: input.professionalId,
    });

    if (input.startsAt < context.earliestStartAt) {
      throw new SlotUnavailableError();
    }

    const endsAt = new Date(
      input.startsAt.getTime() + context.service.durationMinutes * 60_000,
    );
    const [appointments, blocks] = await Promise.all([
      this.appointmentRepository.findOverlapping({
        professionalId: context.professional.id,
        startsAt: input.startsAt,
        endsAt,
        excludeAppointmentId: input.excludeAppointmentId,
      }),
      this.scheduleBlockRepository.findOverlapping({
        professionalId: context.professional.id,
        startsAt: input.startsAt,
        endsAt,
      }),
    ]);

    const available = this.availability.isSlotAvailable({
      startsAt: input.startsAt,
      endsAt,
      weeklyHours: context.weeklyHours,
      appointments,
      blocks,
      timezone: context.timezone,
    });
    if (!available) throw new SlotUnavailableError();

    return { ...context, startsAt: input.startsAt, endsAt };
  }
}
