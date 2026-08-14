import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import {
  BranchProfessionalRepository,
  UpsertBranchProfessionalData,
} from '@domain/branches/repositories/branch-professional.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { branchProfessionals } from '../drizzle/schema/branch-assignment.schema';
import { BranchProfessionalMapper } from '../drizzle/mappers/branch-professional.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleBranchProfessionalRepository
  extends TenantScopedRepository
  implements BranchProfessionalRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async upsert(
    data: UpsertBranchProfessionalData,
  ): Promise<BranchProfessional> {
    try {
      const [row] = await this.drizzle.db
        .insert(branchProfessionals)
        .values({
          tenantId: this.tenantId,
          branchId: data.branchId,
          professionalId: data.professionalId,
          weeklyHours: data.weeklyHours,
          isActive: data.isActive ?? true,
        })
        .onConflictDoUpdate({
          target: [
            branchProfessionals.professionalId,
            branchProfessionals.branchId,
          ],
          set: {
            weeklyHours: data.weeklyHours,
            isActive: data.isActive ?? true,
            updatedAt: new Date(),
          },
        })
        .returning();

      return BranchProfessionalMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findByBranchAndProfessional(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessional | null> {
    const [row] = await this.selectFrom(
      branchProfessionals,
      and(
        eq(branchProfessionals.branchId, branchId),
        eq(branchProfessionals.professionalId, professionalId),
      ),
    );
    return row ? BranchProfessionalMapper.toDomain(row) : null;
  }

  async findByBranch(branchId: string): Promise<BranchProfessional[]> {
    const rows = await this.selectFrom(
      branchProfessionals,
      eq(branchProfessionals.branchId, branchId),
    );
    return rows.map(BranchProfessionalMapper.toDomain);
  }

  async findByProfessional(
    professionalId: string,
  ): Promise<BranchProfessional[]> {
    const rows = await this.selectFrom(
      branchProfessionals,
      eq(branchProfessionals.professionalId, professionalId),
    );
    return rows.map(BranchProfessionalMapper.toDomain);
  }

  async findActiveByBranch(branchId: string): Promise<BranchProfessional[]> {
    const rows = await this.selectFrom(
      branchProfessionals,
      and(
        eq(branchProfessionals.branchId, branchId),
        eq(branchProfessionals.isActive, true),
      ),
    );
    return rows.map(BranchProfessionalMapper.toDomain);
  }

  async deactivate(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessional | null> {
    try {
      const [updated] = await this.updateIn(
        branchProfessionals,
        { isActive: false },
        and(
          eq(branchProfessionals.branchId, branchId),
          eq(branchProfessionals.professionalId, professionalId),
        ),
      );
      return updated ? BranchProfessionalMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(branchProfessionals);
  }
}
