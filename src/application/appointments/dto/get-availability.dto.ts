import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  APPOINTMENT_DURATION_MAX_MINUTES,
  APPOINTMENT_DURATION_STEP_MINUTES,
} from '../services/resolve-appointment-duration';

export class GetAvailabilityDto {
  @ApiProperty()
  @IsUUID()
  professionalId: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Branch to check. Required when the tenant has more than one active branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-08-07T23:59:59.000Z' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({
    description:
      'Staff only. Size free slots to this length instead of the service catalog. Multiples of 15 between 15 and 480.',
    example: 45,
    minimum: APPOINTMENT_DURATION_STEP_MINUTES,
    maximum: APPOINTMENT_DURATION_MAX_MINUTES,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(APPOINTMENT_DURATION_STEP_MINUTES)
  @Max(APPOINTMENT_DURATION_MAX_MINUTES)
  durationMinutes?: number;
}
