import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class GetAvailabilityDto {
  @ApiProperty()
  @IsUUID()
  professionalId: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-08-07T23:59:59.000Z' })
  @IsDateString()
  to: string;
}
