import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

import { Currency } from '@domain/common/value-objects/currency.vo';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';

export class CreatePlanBodyDto {
  @ApiProperty({ example: 'starter' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: '350.00' })
  @IsString()
  priceAmount: string;

  @ApiProperty({ enum: Currency, required: false })
  @IsOptional()
  @IsEnum(Currency)
  priceCurrency?: Currency;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodMonths?: number;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdatePlanBodyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  priceAmount?: string;

  @ApiProperty({ enum: Currency, required: false })
  @IsOptional()
  @IsEnum(Currency)
  priceCurrency?: Currency;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  billingPeriodMonths?: number;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateSubscriptionBodyDto {
  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiProperty({ enum: SubscriptionStatus, required: false })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currentPeriodStart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currentPeriodEnd?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  configOverrides?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RenewSubscriptionBodyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  periodStart?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  periodEnd?: string;
}

export class UpdateSubscriptionBodyDto {
  @ApiProperty({ enum: SubscriptionStatus, required: false })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({ required: false, type: Object, nullable: true })
  @IsOptional()
  configOverrides?: Record<string, unknown> | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChangeSubscriptionPlanBodyDto {
  @ApiProperty()
  @IsUUID()
  planId: string;
}
