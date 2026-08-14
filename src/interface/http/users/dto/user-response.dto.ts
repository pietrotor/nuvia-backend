import { ApiProperty } from '@nestjs/swagger';

import { PublicUser } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  tenantId: string | null;

  @ApiProperty({ nullable: true })
  professionalId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  isActive: boolean;

  static from(user: PublicUser): UserResponseDto {
    return {
      id: user.id,
      tenantId: user.tenantId,
      professionalId: user.professionalId ?? null,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
