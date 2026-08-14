import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Validate } from 'class-validator';

import { MaxDateRangeDaysConstraint } from '@application/common/validators/max-date-range-days.validator';

export class ListScheduleBlocksDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  @Validate(MaxDateRangeDaysConstraint)
  to: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}
