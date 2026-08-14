import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { UserSchema } from '../schema/user.schema';

export class UserMapper {
  static toDomain(row: UserSchema): User {
    return new User({
      id: row.id,
      tenantId: row.tenantId,
      professionalId: row.professionalId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      password: row.password,
      role: row.role as Role,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
