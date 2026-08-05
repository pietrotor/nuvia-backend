import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PaginationDto {
  @ApiPropertyOptional({
    maximum: MAX_PAGE_SIZE,
    description: 'How many rows do you need',
  })
  @IsOptional()
  @IsPositive()
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'How many rows do you want to skip',
  })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
