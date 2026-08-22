import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  APPOINTMENT_DURATION_MAX_MINUTES,
  APPOINTMENT_DURATION_STEP_MINUTES,
} from '../services/resolve-appointment-duration';

export class BookingAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId: string;

  @ApiProperty({ example: 'Axilas' })
  @IsString()
  @MaxLength(1000)
  value: string;
}

export class BookAppointmentDto {
  @ApiProperty({
    description: 'Person who will receive the service',
  })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Person who is managing the booking. Defaults to clientId when omitted.',
  })
  @IsOptional()
  @IsUUID()
  bookingContactClientId?: string;

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

  @ApiPropertyOptional({ type: [BookingAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingAnswerDto)
  answers?: BookingAnswerDto[];
}
