import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleBlockDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  professionalId?: string | null;

  @ApiProperty({ example: '2026-08-10T12:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2026-08-10T13:00:00.000Z' })
  @IsDateString()
  endsAt: string;

  @ApiProperty({ example: 'Almuerzo', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
