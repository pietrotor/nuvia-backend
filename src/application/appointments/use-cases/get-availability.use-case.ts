import { Injectable } from '@nestjs/common';

import { TimeSlot } from '@domain/appointments/services/availability-calculator';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { GetAvailabilityDto } from '../dto/get-availability.dto';
import { resolveAppointmentDuration } from '../services/resolve-appointment-duration';
import { FindAvailabilityOptionsUseCase } from './find-availability-options.use-case';

// The flat list the panel and the public page consume. The reasoning lives one level
// down, so there is a single path that decides what is bookable.
@Injectable()
export class GetAvailabilityUseCase {
  constructor(private readonly findOptions: FindAvailabilityOptionsUseCase) {}

  async execute(
    dto: GetAvailabilityDto,
    actor: BookingActor = BookingActor.CLIENT,
  ): Promise<TimeSlot[]> {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (to <= from) return [];

    const { service, slots } = await this.findOptions.execute({
      serviceId: dto.serviceId,
      professionalId: dto.professionalId,
      branchId: dto.branchId,
      from,
      to,
      actor,
      durationMinutes: dto.durationMinutes,
    });

    const durationMinutes = resolveAppointmentDuration({
      serviceDurationMinutes: service.durationMinutes,
      actor,
      durationMinutes: dto.durationMinutes,
    });

    return slots.map((slot) => ({
      startsAt: slot.startsAt,
      endsAt: new Date(slot.startsAt.getTime() + durationMinutes * 60_000),
    }));
  }
}
