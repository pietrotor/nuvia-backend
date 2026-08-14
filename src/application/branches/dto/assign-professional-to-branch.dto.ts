import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WeeklyHoursDto } from '@application/common/dto/weekly-hours.dto';

export class AssignProfessionalToBranchDto {
  @ApiProperty({ type: WeeklyHoursDto })
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  weeklyHours: WeeklyHoursDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
