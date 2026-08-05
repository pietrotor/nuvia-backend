import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { WeeklyHoursDto } from '@application/common/dto/weekly-hours.dto';

export class CreateProfessionalDto {
  @ApiProperty({ example: 'Camila Rojas' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: WeeklyHoursDto })
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  weeklyHours: WeeklyHoursDto;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
