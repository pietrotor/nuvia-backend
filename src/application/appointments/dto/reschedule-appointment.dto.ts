import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-08-05T15:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({
    description: 'New professional, if the appointment changes hands',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'New branch, if the appointment moves to another location',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Staff only. New length in minutes. When omitted, the appointment keeps the span it already had. Multiples of 15 between 15 and 480.',
    example: 45,
    minimum: APPOINTMENT_DURATION_STEP_MINUTES,
    maximum: APPOINTMENT_DURATION_MAX_MINUTES,
  })
  @IsOptional()
  @IsInt()
  @Min(APPOINTMENT_DURATION_STEP_MINUTES)
  @Max(APPOINTMENT_DURATION_MAX_MINUTES)
  durationMinutes?: number;
}
