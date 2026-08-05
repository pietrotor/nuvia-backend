import { Injectable } from '@nestjs/common';

import {
  CreateProfessionalData,
  ProfessionalRepository,
  UpdateProfessionalData,
} from '@domain/professionals/repositories/professional.repository';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { professionals } from '../drizzle/schema/professional.schema';
import { ProfessionalMapper } from '../drizzle/mappers/professional.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleProfessionalRepository
  extends TenantScopedRepository
  implements ProfessionalRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateProfessionalData): Promise<Professional> {
    try {
      const [created] = await this.insertInto(professionals, {
        name: data.name,
        weeklyHours: data.weeklyHours,
        isActive: data.isActive ?? true,
      });
      return ProfessionalMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Professional | null> {
    const [row] = await this.selectFrom(
      professionals,
      eq(professionals.id, id),
    );
    return row ? ProfessionalMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Professional[]> {
    const rows = await this.selectFrom(professionals);
    return rows.map(ProfessionalMapper.toDomain);
  }

  async update(
    id: string,
    data: UpdateProfessionalData,
  ): Promise<Professional | null> {
    try {
      const [updated] = await this.updateIn(
        professionals,
        data,
        eq(professionals.id, id),
      );
      return updated ? ProfessionalMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(professionals);
  }
}
