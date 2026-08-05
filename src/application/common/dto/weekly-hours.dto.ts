import { Type } from 'class-transformer';
import {
  IsDefined,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DayHoursDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  start: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  end: string;
}

export class WeeklyHoursDto {
  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  mon: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  tue: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  wed: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  thu: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  fri: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  sat: DayHoursDto | null;

  @ApiProperty({ type: DayHoursDto, nullable: true })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => DayHoursDto)
  sun: DayHoursDto | null;
}
