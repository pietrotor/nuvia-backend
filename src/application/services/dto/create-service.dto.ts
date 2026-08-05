import {
  ArrayUnique,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { Currency } from '@domain/common/value-objects/currency.vo';

export class CreateServiceDto {
  @ApiProperty({ example: 'Limpieza facial' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;

  @ApiProperty({ example: '150.00' })
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  price: string;

  @ApiProperty({
    enum: Currency,
    required: false,
    description: 'Defaults to the currency of the business',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  requiresDeposit?: boolean;

  @ApiProperty({ example: '50.00', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  depositAmount?: string | null;

  @ApiProperty({ example: 30, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number | null;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  professionalIds: string[];

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
