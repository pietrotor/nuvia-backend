import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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

  @ApiProperty({ example: '+59171234567', required: false })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone?: string;
}
