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

export class BookAppointmentDto {
  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty()
  @IsUUID()
  professionalId: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Branch where the appointment takes place. Required when the tenant has more than one active branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: '2026-08-05T15:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({
    description:
      'Staff only. Length of this appointment in minutes, instead of the service catalog. Multiples of 15 between 15 and 480. Ignored for the agent and the public page.',
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
