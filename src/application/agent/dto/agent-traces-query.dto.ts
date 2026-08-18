import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { PaginationDto } from '@application/common/dto/pagination.dto';

export class AgentTracesTenantQueryDto extends PaginationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant whose traces to inspect',
  })
  @IsUUID()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Search by client name or phone' })
  @IsOptional()
  search?: string;
}

export class AgentTracesTenantOnlyQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant whose traces to inspect',
  })
  @IsUUID()
  tenantId: string;
}

export class AgentEconomicsQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant whose LLM economics to summarize',
  })
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive start of the period (ISO 8601)',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Exclusive end of the period (ISO 8601)',
  })
  @IsDateString()
  to: string;
}

export class PruneAgentTracesDto {
  @ApiProperty({ format: 'uuid', description: 'Tenant whose traces to prune' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    minimum: 1,
    maximum: 3650,
    description: 'Delete traces older than this many days',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  olderThanDays: number;
}
