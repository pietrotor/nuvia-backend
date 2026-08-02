import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { Vertical } from '@domain/tenants/value-objects/vertical.vo';
import { TenantSchema } from '../schema/tenant.schema';

export class TenantMapper {
  static toDomain(row: TenantSchema): Tenant {
    return new Tenant({
      id: row.id,
      name: row.name,
      vertical: row.vertical as Vertical,
      status: row.status as TenantStatus,
      timezone: row.timezone,
      verticalTemplateId: row.verticalTemplateId,
      sendWindowConfig: row.sendWindowConfig,
      whatsappPhone: row.whatsappPhone,
      plan: row.plan,
      staticQrUrl: row.staticQrUrl,
      paymentsEmail: row.paymentsEmail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
