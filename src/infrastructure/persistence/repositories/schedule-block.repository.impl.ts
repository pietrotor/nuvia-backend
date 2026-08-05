import { Injectable } from '@nestjs/common';
import { and, eq, gt, lt, or, isNull } from 'drizzle-orm';

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
  }): Promise<ScheduleBlock[]> {
    const professionalFilter = input.professionalId
      ? or(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.professionalId, input.professionalId),
        )
      : isNull(scheduleBlocks.professionalId);

    const rows = await this.selectFrom(
      scheduleBlocks,
      and(
        professionalFilter!,
        eq(scheduleBlocks.isActive, true),
        lt(scheduleBlocks.startsAt, input.endsAt),
        gt(scheduleBlocks.endsAt, input.startsAt),
      )!,
    );

    return rows.map(ScheduleBlockMapper.toDomain);
  }

  async findInRange(
    from: Date,
    to: Date,
    professionalId?: string,
  ): Promise<ScheduleBlock[]> {
    const filters = [
      eq(scheduleBlocks.isActive, true),
      lt(scheduleBlocks.startsAt, to),
      gt(scheduleBlocks.endsAt, from),
    ];
    if (professionalId) {
      filters.push(
        or(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.professionalId, professionalId),
        )!,
      );
    }

    const rows = await this.selectFrom(scheduleBlocks, and(...filters)!);
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

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(scheduleBlocks);
  }
}
