import { ApiProperty } from '@nestjs/swagger';

import { TimeSlot } from '@domain/appointments/services/availability-calculator';

export class AvailabilitySlotResponseDto {
  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  static from(slot: TimeSlot): AvailabilitySlotResponseDto {
    return {
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    };
  }
}
