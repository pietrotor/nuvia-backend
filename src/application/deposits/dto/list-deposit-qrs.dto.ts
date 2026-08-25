import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ListDepositQrsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Return only QRs assigned to this branch; omit it to return all scopes',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Include the QRs the owner archived',
  })
  @IsOptional()
  @IsBoolean()
  // Type(() => Boolean) turns the string "false" into true, so the query value is
  // compared explicitly.
  @Transform(({ value }) => value === 'true' || value === true)
  includeArchived?: boolean;
}
