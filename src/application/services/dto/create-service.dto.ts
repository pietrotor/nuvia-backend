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
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { Currency } from '@domain/common/value-objects/currency.vo';
import { BookingQuestionKind } from '@domain/services/value-objects/booking-question-kind.vo';

export class ServiceBookingQuestionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: '¿Qué zona querés tratar?' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  prompt: string;

  @ApiProperty({ enum: BookingQuestionKind })
  @IsEnum(BookingQuestionKind)
  kind: BookingQuestionKind;

  @ApiProperty({ default: true })
  @IsBoolean()
  isRequired: boolean;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateServiceDto {
  @ApiProperty({ example: 'Limpieza facial' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Optional description shown to the agent for matching',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({
    type: [String],
    required: false,
    description:
      'Alternate names a client might use (e.g. masaje chino, descontracturante)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keywords?: string[];

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

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'QR to charge the deposit with. Omit it to use the default of the business',
  })
  @IsOptional()
  @IsUUID()
  depositQrId?: string | null;

  @ApiProperty({
    default: true,
    required: false,
    description:
      'Whether the agent offers the client a professional to pick for this service',
  })
  @IsOptional()
  @IsBoolean()
  clientChoosesProfessional?: boolean;

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

  @ApiProperty({ type: [ServiceBookingQuestionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceBookingQuestionDto)
  bookingQuestions?: ServiceBookingQuestionDto[];
}
