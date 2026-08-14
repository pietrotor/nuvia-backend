import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { UserBranchRepository } from '@domain/branches/repositories/user-branch.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { userBranches } from '../drizzle/schema/branch-assignment.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleUserBranchRepository
  extends TenantScopedRepository
  implements UserBranchRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async setForUser(userId: string, branchIds: string[]): Promise<void> {
    const tenantId = this.tenantId;

    try {
      await this.drizzle.db.transaction(async (tx) => {
        await tx
          .delete(userBranches)
          .where(
            and(
              eq(userBranches.tenantId, tenantId),
              eq(userBranches.userId, userId),
            ),
          );

        if (branchIds.length === 0) return;

        await tx.insert(userBranches).values(
          branchIds.map((branchId) => ({
            tenantId,
            userId,
            branchId,
          })),
        );
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findBranchIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.selectFrom(
      userBranches,
      eq(userBranches.userId, userId),
    );
    return rows.map((row) => row.branchId);
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(userBranches);
  }
}
