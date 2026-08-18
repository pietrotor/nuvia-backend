import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';
import {
  BranchProfessionalServiceWindowRepository,
  UpsertBranchProfessionalServiceWindowData,
} from '@domain/branches/repositories/branch-professional-service-window.repository';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { BranchProfessionalServiceWindowMapper } from '../drizzle/mappers/branch-professional-service-window.mapper';
import { branchProfessionalServiceWindows } from '../drizzle/schema/branch-assignment.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleBranchProfessionalServiceWindowRepository
  extends TenantScopedRepository
  implements BranchProfessionalServiceWindowRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async upsert(
    data: UpsertBranchProfessionalServiceWindowData,
  ): Promise<BranchProfessionalServiceWindow> {
    try {
      const [row] = await this.drizzle.db
        .insert(branchProfessionalServiceWindows)
        .values({
          tenantId: this.tenantId,
          branchId: data.branchId,
          professionalId: data.professionalId,
          serviceId: data.serviceId,
          weeklyHours: data.weeklyHours,
          isActive: data.isActive ?? true,
        })
        .onConflictDoUpdate({
          target: [
            branchProfessionalServiceWindows.branchId,
            branchProfessionalServiceWindows.professionalId,
            branchProfessionalServiceWindows.serviceId,
          ],
          set: {
            weeklyHours: data.weeklyHours,
            isActive: data.isActive ?? true,
            updatedAt: new Date(),
          },
        })
        .returning();

      return BranchProfessionalServiceWindowMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findByAssignmentAndService(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null> {
    const [row] = await this.selectFrom(
      branchProfessionalServiceWindows,
      and(
        eq(branchProfessionalServiceWindows.branchId, branchId),
        eq(branchProfessionalServiceWindows.professionalId, professionalId),
        eq(branchProfessionalServiceWindows.serviceId, serviceId),
      ),
    );
    return row ? BranchProfessionalServiceWindowMapper.toDomain(row) : null;
  }

  async findActiveByAssignmentAndService(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null> {
    const [row] = await this.selectFrom(
      branchProfessionalServiceWindows,
      and(
        eq(branchProfessionalServiceWindows.branchId, branchId),
        eq(branchProfessionalServiceWindows.professionalId, professionalId),
        eq(branchProfessionalServiceWindows.serviceId, serviceId),
        eq(branchProfessionalServiceWindows.isActive, true),
      ),
    );
    return row ? BranchProfessionalServiceWindowMapper.toDomain(row) : null;
  }

  async findByAssignment(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessionalServiceWindow[]> {
    const rows = await this.selectFrom(
      branchProfessionalServiceWindows,
      and(
        eq(branchProfessionalServiceWindows.branchId, branchId),
        eq(branchProfessionalServiceWindows.professionalId, professionalId),
      ),
    );
    return rows.map(BranchProfessionalServiceWindowMapper.toDomain);
  }

  async deactivate(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null> {
    try {
      const [updated] = await this.updateIn(
        branchProfessionalServiceWindows,
        { isActive: false },
        and(
          eq(branchProfessionalServiceWindows.branchId, branchId),
          eq(branchProfessionalServiceWindows.professionalId, professionalId),
          eq(branchProfessionalServiceWindows.serviceId, serviceId),
        ),
      );
      return updated
        ? BranchProfessionalServiceWindowMapper.toDomain(updated)
        : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(branchProfessionalServiceWindows);
  }
}
