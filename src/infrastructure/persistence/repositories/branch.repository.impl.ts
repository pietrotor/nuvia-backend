import { Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';

import { Branch } from '@domain/branches/entities/branch.entity';
import {
  BranchRepository,
  CreateBranchData,
  UpdateBranchData,
} from '@domain/branches/repositories/branch.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { branches } from '../drizzle/schema/branch.schema';
import { BranchMapper } from '../drizzle/mappers/branch.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleBranchRepository
  extends TenantScopedRepository
  implements BranchRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateBranchData): Promise<Branch> {
    try {
      const [created] = await this.insertInto(branches, {
        name: data.name,
        slug: data.slug,
        address: data.address,
        mapsUrl: data.mapsUrl,
        phone: data.phone,
        weeklyHours: data.weeklyHours,
        timezone: data.timezone,
        isPrimary: data.isPrimary ?? false,
        isActive: data.isActive ?? true,
      });
      return BranchMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Branch | null> {
    const [row] = await this.selectFrom(branches, eq(branches.id, id));
    return row ? BranchMapper.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Branch | null> {
    const [row] = await this.selectFrom(branches, eq(branches.slug, slug));
    return row ? BranchMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Branch[]> {
    const rows = await this.selectFrom(branches);
    return rows.map(BranchMapper.toDomain);
  }

  async findActive(): Promise<Branch[]> {
    const rows = await this.selectFrom(branches, eq(branches.isActive, true));
    return rows.map(BranchMapper.toDomain);
  }

  async findPrimary(): Promise<Branch | null> {
    const [row] = await this.selectFrom(
      branches,
      and(eq(branches.isPrimary, true), eq(branches.isActive, true)),
    );
    return row ? BranchMapper.toDomain(row) : null;
  }

  async update(id: string, data: UpdateBranchData): Promise<Branch | null> {
    try {
      const [updated] = await this.updateIn(
        branches,
        data,
        eq(branches.id, id),
      );
      return updated ? BranchMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async countActive(): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ total: count() })
      .from(branches)
      .where(this.scope(branches, eq(branches.isActive, true)));

    return Number(row?.total ?? 0);
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(branches);
  }
}
