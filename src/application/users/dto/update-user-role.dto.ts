import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { Role } from '@domain/users/value-objects/role.vo';

const TENANT_ROLES = [Role.OWNER, Role.STAFF];

export class UpdateUserRoleDto {
  @ApiProperty({ enum: TENANT_ROLES, example: Role.OWNER })
  @IsEnum(TENANT_ROLES)
  role: Role;
}
