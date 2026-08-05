import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

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
  to?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filters appointments by professional.',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
