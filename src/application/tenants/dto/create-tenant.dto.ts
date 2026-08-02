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

import { Vertical } from '@domain/tenants/value-objects/vertical.vo';

export class TenantOwnerDto {
  @ApiProperty({ example: 'Ana Quiroga' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ana@academiadanza.bo' })
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
  @ApiProperty({ example: 'Academia de Danza Ritmo' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: Vertical, example: Vertical.ACADEMY })
  @IsEnum(Vertical)
  vertical: Vertical;

  @ApiProperty({ example: 'America/La_Paz', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 'trial', required: false })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiProperty({ type: TenantOwnerDto })
  @ValidateNested()
  @Type(() => TenantOwnerDto)
  owner: TenantOwnerDto;
}
