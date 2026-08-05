import { Injectable } from '@nestjs/common';
import { SQL, and, eq, gt, isNull, lt, or } from 'drizzle-orm';

import {
  ScheduleBlockView,
  ScheduleBlockViewRepository,
} from '@domain/schedule-blocks/repositories/schedule-block-view.repository';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { professionals } from '../drizzle/schema/professional.schema';
import { scheduleBlocks } from '../drizzle/schema/schedule-block.schema';
import { ScheduleBlockMapper } from '../drizzle/mappers/schedule-block.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleScheduleBlockViewRepository
  extends TenantScopedRepository
  implements ScheduleBlockViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  // A block for a single professional and one for the whole business coexist in the
  // same view, so the join is left: with no professional there is no summary.
  async findInRange(input: {
    from: Date;
    to: Date;
    professionalId?: string;
  }): Promise<ScheduleBlockView[]> {
    const filters: (SQL | undefined)[] = [
      eq(scheduleBlocks.isActive, true),
      lt(scheduleBlocks.startsAt, input.to),
      gt(scheduleBlocks.endsAt, input.from),
    ];
    if (input.professionalId) {
      filters.push(
        or(
          isNull(scheduleBlocks.professionalId),
          eq(scheduleBlocks.professionalId, input.professionalId),
        ),
      );
    }

    const rows = await this.drizzle.db
      .select({
        block: scheduleBlocks,
        professional: {
          id: professionals.id,
          name: professionals.name,
        },
      })
      .from(scheduleBlocks)
      .leftJoin(
        professionals,
        and(
          eq(professionals.id, scheduleBlocks.professionalId),
          eq(professionals.tenantId, scheduleBlocks.tenantId),
        ),
      )
      .where(this.scope(scheduleBlocks, ...filters))
      .orderBy(scheduleBlocks.startsAt);

    return rows.map((row) => ({
      block: ScheduleBlockMapper.toDomain(row.block),
      professional: row.professional?.id ? row.professional : null,
    }));
  }
}
