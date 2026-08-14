import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '@application/common/dto/pagination.dto';

export class SearchClientsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'María',
    description:
      'Matches the name or the phone of the client. With no term, returns the first clients by name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
