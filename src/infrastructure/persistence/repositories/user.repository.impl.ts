import { Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';

import {
  CreateUserData,
  UpdateUserData,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { DrizzleService } from '../drizzle/drizzle.service';
import { users } from '../drizzle/schema';
import { UserMapper } from '../drizzle/mappers/user.mapper';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleUserRepository
  extends TenantScopedRepository
  implements UserRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async findByEmailUnscoped(email: string): Promise<User | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return row ? UserMapper.toDomain(row) : null;
  }

  async findByIdUnscoped(id: string): Promise<User | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row ? UserMapper.toDomain(row) : null;
  }

  async createSuperadminUnscoped(
    data: Omit<CreateUserData, 'role'>,
  ): Promise<User> {
    try {
      const [created] = await this.drizzle.db
        .insert(users)
        .values({ ...data, tenantId: null, role: Role.SUPERADMIN })
        .returning();

      return UserMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      const [created] = await this.insertInto(users, {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        phone: data.phone,
        isActive: data.isActive ?? true,
      });

      return UserMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.selectFrom(users, eq(users.id, id));

    return row ? UserMapper.toDomain(row) : null;
  }

  async findAllOfTenant(): Promise<User[]> {
    const rows = await this.selectFrom(users);

    return rows.map(UserMapper.toDomain);
  }

  async countActiveOwners(): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ total: count() })
      .from(users)
      .where(
        this.scope(users, eq(users.role, Role.OWNER), eq(users.isActive, true)),
      );

    return Number(row?.total ?? 0);
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    try {
      const [updated] = await this.updateIn(users, data, eq(users.id, id));

      return updated ? UserMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async delete(id: string): Promise<void> {
    await this.deleteFrom(users, eq(users.id, id));
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(users);
  }
}
