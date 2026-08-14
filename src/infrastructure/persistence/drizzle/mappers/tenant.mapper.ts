import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';

import { TenantSchema } from '../schema/tenant.schema';

export class TenantMapper {
  static toDomain(row: TenantSchema): Tenant {
    return new Tenant({
      id: row.id,
      name: row.name,
      status: row.status as TenantStatus,
      timezone: row.timezone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
