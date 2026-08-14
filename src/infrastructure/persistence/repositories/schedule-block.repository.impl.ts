import { Injectable } from '@nestjs/common';
import { SQL, and, eq, gt, lt, or, isNull } from 'drizzle-orm';

import {
  CreateScheduleBlockData,
  ScheduleBlockRepository,
  UpdateScheduleBlockData,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { scheduleBlocks } from '../drizzle/schema/schedule-block.schema';
import { ScheduleBlockMapper } from '../drizzle/mappers/schedule-block.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleScheduleBlockRepository
  extends TenantScopedRepository
  implements ScheduleBlockRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateScheduleBlockData): Promise<ScheduleBlock> {
    try {
      const [created] = await this.insertInto(scheduleBlocks, {
        branchId: data.branchId,
        professionalId: data.professionalId ?? null,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        reason: data.reason,
        isActive: true,
      });
      return ScheduleBlockMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<ScheduleBlock | null> {
    const [row] = await this.selectFrom(
      scheduleBlocks,
      eq(scheduleBlocks.id, id),
    );
    return row ? ScheduleBlockMapper.toDomain(row) : null;
  }

  async findOverlapping(input: {
    professionalId: string | null;
    startsAt: Date;
    endsAt: Date;
    branchId?: string;
  }): Promise<ScheduleBlock[]> {
    const rows = await this.selectFrom(
      scheduleBlocks,
      and(
        this.appliesTo(input.professionalId, input.branchId),
        eq(scheduleBlocks.isActive, true),
        lt(scheduleBlocks.startsAt, input.endsAt),
        gt(scheduleBlocks.endsAt, input.startsAt),
      )!,
    );

    return rows.map(ScheduleBlockMapper.toDomain);
  }

  async findInRange(input: {
    from: Date;
    to: Date;
    professionalId?: string;
    branchId?: string;
  }): Promise<ScheduleBlock[]> {
    const rows = await this.selectFrom(
      scheduleBlocks,
      and(
        this.appliesTo(input.professionalId ?? null, input.branchId),
        eq(scheduleBlocks.isActive, true),
        lt(scheduleBlocks.startsAt, input.to),
        gt(scheduleBlocks.endsAt, input.from),
      )!,
    );
    return rows.map(ScheduleBlockMapper.toDomain);
  }

  async update(
    id: string,
    data: UpdateScheduleBlockData,
  ): Promise<ScheduleBlock | null> {
    try {
      const [updated] = await this.updateIn(
        scheduleBlocks,
        data,
        eq(scheduleBlocks.id, id),
      );
      return updated ? ScheduleBlockMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async assignBranchToAllWithoutBranch(branchId: string): Promise<number> {
    const updated = await this.updateIn(
      scheduleBlocks,
      { branchId },
      isNull(scheduleBlocks.branchId),
    );
    return updated.length;
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(scheduleBlocks);
  }

  // Blocks that apply when checking availability for (branchId, professionalId):
  // 1. null/null — whole business
  // 2. null/branch — branch closed
  // 3. professional/null — absent everywhere
  // 4. professional/branch — absent at this branch
  // Without a branch, only unscoped (branchId null) blocks are considered.
  private appliesTo(
    professionalId: string | null,
    branchId?: string,
  ): SQL | undefined {
    if (branchId && professionalId) {
      return or(
        and(
          isNull(scheduleBlocks.professionalId),
          isNull(scheduleBlocks.branchId),
        ),
        and(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.branchId, branchId),
        ),
        and(
          eq(scheduleBlocks.professionalId, professionalId),
          isNull(scheduleBlocks.branchId),
        ),
        and(
          eq(scheduleBlocks.professionalId, professionalId),
          eq(scheduleBlocks.branchId, branchId),
        ),
      );
    }

    if (branchId) {
      return or(
        and(
          isNull(scheduleBlocks.professionalId),
          isNull(scheduleBlocks.branchId),
        ),
        and(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.branchId, branchId),
        ),
      );
    }

    if (professionalId) {
      return and(
        isNull(scheduleBlocks.branchId),
        or(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.professionalId, professionalId),
        ),
      );
    }

    return and(
      isNull(scheduleBlocks.branchId),
      isNull(scheduleBlocks.professionalId),
    );
  }
}
