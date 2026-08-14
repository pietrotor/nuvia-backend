import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';

import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';
import {
  CreateDepositQrData,
  DepositQrRepository,
  FindDepositQrsOptions,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { depositQrs } from '../drizzle/schema/deposit.schema';
import { DepositQrMapper } from '../drizzle/mappers/deposit-qr.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleDepositQrRepository
  extends TenantScopedRepository
  implements DepositQrRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateDepositQrData): Promise<DepositQr> {
    try {
      const [created] = await this.insertInto(depositQrs, {
        branchId: data.branchId,
        label: data.label,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        isDefault: data.isDefault ?? false,
      });

      return DepositQrMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(depositQr: DepositQr): Promise<DepositQr> {
    try {
      const [updated] = await this.updateIn(
        depositQrs,
        {
          label: depositQr.label,
          isDefault: depositQr.isDefault,
          isActive: depositQr.isActive,
        },
        eq(depositQrs.id, depositQr.id),
      );

      return DepositQrMapper.toDomain(updated);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<DepositQr | null> {
    const [row] = await this.selectFrom(depositQrs, eq(depositQrs.id, id));

    return row ? DepositQrMapper.toDomain(row) : null;
  }

  async findAll(options?: FindDepositQrsOptions): Promise<DepositQr[]> {
    const rows = await this.drizzle.db
      .select()
      .from(depositQrs)
      .where(
        options?.includeArchived
          ? this.scope(depositQrs)
          : this.scope(depositQrs, eq(depositQrs.isActive, true)),
      )
      .orderBy(asc(depositQrs.createdAt));

    return rows.map(DepositQrMapper.toDomain);
  }

  async promoteToDefault(id: string): Promise<DepositQr | null> {
    const tenantId = this.tenantId;

    try {
      return await this.drizzle.db.transaction(async (tx) => {
        // Demote first: the partial unique index allows a single default per
        // tenant, so promoting before demoting would violate it.
        await tx
          .update(depositQrs)
          .set({ isDefault: false })
          .where(
            and(
              eq(depositQrs.tenantId, tenantId),
              eq(depositQrs.isDefault, true),
              ne(depositQrs.id, id),
            ),
          );

        // Active as well: the QR the business charges with by default has to be one
        // it is still using.
        const [promoted] = await tx
          .update(depositQrs)
          .set({ isDefault: true, isActive: true })
          .where(and(eq(depositQrs.tenantId, tenantId), eq(depositQrs.id, id)))
          .returning();

        return promoted ? DepositQrMapper.toDomain(promoted) : null;
      });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async assignBranchToAllWithoutBranch(branchId: string): Promise<number> {
    const updated = await this.updateIn(
      depositQrs,
      { branchId },
      isNull(depositQrs.branchId),
    );
    return updated.length;
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(depositQrs);
  }
}
