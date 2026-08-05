import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ListScheduleBlocksDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  to: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
