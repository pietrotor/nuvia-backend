import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListDepositQrsDto {
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
