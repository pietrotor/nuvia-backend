import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { WeeklyHoursDto } from '@application/common/dto/weekly-hours.dto';

export class CreateBranchDto {
  @ApiProperty({ example: 'Sucursal Centro' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'centro' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Av. Ballivián 1234, La Paz',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=-16.5,-68.1',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mapsUrl?: string | null;

  @ApiPropertyOptional({ example: '+59170000000', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiProperty({ type: WeeklyHoursDto })
  @ValidateNested()
  @Type(() => WeeklyHoursDto)
  weeklyHours: WeeklyHoursDto;

  @ApiPropertyOptional({
    example: 'America/La_Paz',
    nullable: true,
    description: 'Null inherits the tenant timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @ApiPropertyOptional({
    default: false,
    description: 'First branch is always primary; otherwise promotes this one',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
