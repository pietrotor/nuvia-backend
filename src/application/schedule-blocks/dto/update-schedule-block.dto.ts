import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateScheduleBlockDto } from './create-schedule-block.dto';

export class UpdateScheduleBlockDto extends PartialType(
  CreateScheduleBlockDto,
) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
