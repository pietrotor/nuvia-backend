import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

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

  @ApiProperty({ example: '2026-08-05T15:00:00.000Z' })
  @IsDateString()
  startsAt: string;
}
