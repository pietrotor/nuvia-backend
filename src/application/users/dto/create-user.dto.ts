import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Role } from '@domain/users/value-objects/role.vo';

const TENANT_ROLES = [Role.OWNER, Role.STAFF];

export class CreateUserDto {
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

  @ApiProperty({ enum: TENANT_ROLES, example: Role.STAFF })
  @IsEnum(TENANT_ROLES)
  role: Role;

  @ApiProperty({ example: '71234567', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
