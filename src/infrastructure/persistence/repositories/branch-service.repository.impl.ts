import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { BranchService } from '@domain/branches/entities/branch-service.entity';
import {
  BranchServiceRepository,
  UpsertBranchServiceData,
} from '@domain/branches/repositories/branch-service.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { branchServices } from '../drizzle/schema/branch-assignment.schema';
import { BranchServiceMapper } from '../drizzle/mappers/branch-service.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleBranchServiceRepository
  extends TenantScopedRepository
  implements BranchServiceRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async upsert(data: UpsertBranchServiceData): Promise<BranchService> {
    try {
      const [row] = await this.drizzle.db
        .insert(branchServices)
        .values({
          tenantId: this.tenantId,
          branchId: data.branchId,
          serviceId: data.serviceId,
          priceOverride: data.priceOverrideAmount ?? null,
          depositAmountOverride: data.depositAmountOverrideAmount ?? null,
          depositQrId: data.depositQrId ?? null,
          isActive: data.isActive ?? true,
        })
        .onConflictDoUpdate({
          target: [branchServices.branchId, branchServices.serviceId],
          set: {
            priceOverride: data.priceOverrideAmount ?? null,
            depositAmountOverride: data.depositAmountOverrideAmount ?? null,
            depositQrId: data.depositQrId ?? null,
            isActive: data.isActive ?? true,
            updatedAt: new Date(),
          },
        })
        .returning();

      return BranchServiceMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findByBranchAndService(
    branchId: string,
    serviceId: string,
  ): Promise<BranchService | null> {
    const [row] = await this.selectFrom(
      branchServices,
      and(
        eq(branchServices.branchId, branchId),
        eq(branchServices.serviceId, serviceId),
      ),
    );
    return row ? BranchServiceMapper.toDomain(row) : null;
  }

  async findByBranch(branchId: string): Promise<BranchService[]> {
    const rows = await this.selectFrom(
      branchServices,
      eq(branchServices.branchId, branchId),
    );
    return rows.map(BranchServiceMapper.toDomain);
  }

  async findActiveByBranch(branchId: string): Promise<BranchService[]> {
    const rows = await this.selectFrom(
      branchServices,
      and(
        eq(branchServices.branchId, branchId),
        eq(branchServices.isActive, true),
      ),
    );
    return rows.map(BranchServiceMapper.toDomain);
  }

  async deactivate(
    branchId: string,
    serviceId: string,
  ): Promise<BranchService | null> {
    try {
      const [updated] = await this.updateIn(
        branchServices,
        { isActive: false },
        and(
          eq(branchServices.branchId, branchId),
          eq(branchServices.serviceId, serviceId),
        ),
      );
      return updated ? BranchServiceMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(branchServices);
  }
}
