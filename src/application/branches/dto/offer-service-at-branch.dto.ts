import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OfferServiceAtBranchDto {
  @ApiPropertyOptional({
    example: '140.00',
    nullable: true,
    description: 'Null keeps the catalog price',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  priceOverride?: string | null;

  @ApiPropertyOptional({
    example: '50.00',
    nullable: true,
    description: 'Null keeps the catalog deposit amount',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  depositAmountOverride?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null uses the service or business default QR',
  })
  @IsOptional()
  @IsUUID()
  depositQrId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
