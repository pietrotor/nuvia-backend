import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

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
}
