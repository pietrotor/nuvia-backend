import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { ScheduleBlockSchema } from '../schema/schedule-block.schema';

export class ScheduleBlockMapper {
  static toDomain(row: ScheduleBlockSchema): ScheduleBlock {
    return new ScheduleBlock({
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      professionalId: row.professionalId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      reason: row.reason,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
