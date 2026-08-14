import { Branch } from '@domain/branches/entities/branch.entity';

import { BranchSchema } from '../schema/branch.schema';

export class BranchMapper {
  static toDomain(row: BranchSchema): Branch {
    return new Branch({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      slug: row.slug,
      address: row.address,
      mapsUrl: row.mapsUrl,
      phone: row.phone,
      weeklyHours: row.weeklyHours,
      timezone: row.timezone,
      isPrimary: row.isPrimary,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
