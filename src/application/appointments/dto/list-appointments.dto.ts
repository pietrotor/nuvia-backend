import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Validate,
} from 'class-validator';

import { MaxDateRangeDaysConstraint } from '@application/common/validators/max-date-range-days.validator';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';

const toOptionalStringArray = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
};

export class ListAppointmentsDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description:
      'First day of the range in the business timezone. With no dates, uses today.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description:
      'Last day of the range in the business timezone. If a single date is sent, uses that same day.',
  })
  @IsOptional()
  @IsDateString()
  @Validate(MaxDateRangeDaysConstraint)
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Legacy single professional filter. Prefer professionalIds.',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filters appointments by one or more professionals.',
  })
  @IsOptional()
  @Transform(toOptionalStringArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  professionalIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Filters appointments by one or more services.',
  })
  @IsOptional()
  @Transform(toOptionalStringArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  serviceIds?: string[];

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    isArray: true,
    description: 'Filters appointments by one or more statuses.',
  })
  @IsOptional()
  @Transform(toOptionalStringArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsEnum(AppointmentStatus, { each: true })
  statuses?: AppointmentStatus[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filters appointments by branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
