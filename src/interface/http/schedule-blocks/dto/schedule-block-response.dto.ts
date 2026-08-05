import { ApiProperty } from '@nestjs/swagger';

import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';

export class ScheduleBlockResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  professionalId: string | null;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty()
  isActive: boolean;

  static from(block: ScheduleBlock): ScheduleBlockResponseDto {
    return {
      id: block.id,
      professionalId: block.professionalId,
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
      reason: block.reason,
      isActive: block.isActive,
    };
  }
}
