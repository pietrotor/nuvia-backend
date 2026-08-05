import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';

export class TenantOwnerDto {
  @ApiProperty({ example: 'Ana Quiroga' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ana@glow.bo' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secreta123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '+59171234567', required: false })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Estética Glow' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'America/La_Paz', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 'trial', required: false })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiProperty({ example: 'estetica-glow', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiProperty({
    enum: BusinessCategory,
    required: false,
    description: 'Trade the agent is set up for. Defaults to a generic one',
  })
  @IsOptional()
  @IsEnum(BusinessCategory)
  businessCategory?: BusinessCategory;

  @ApiProperty({ type: TenantOwnerDto })
  @ValidateNested()
  @Type(() => TenantOwnerDto)
  owner: TenantOwnerDto;
}
