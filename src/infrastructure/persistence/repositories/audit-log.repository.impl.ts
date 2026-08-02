import { Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';

import {
  AuditLogRepository,
  RecordAuditData,
} from '@domain/audit/repositories/audit-log.repository';
import { AuditLog } from '@domain/audit/entities/audit-log.entity';
import { DrizzleService } from '../drizzle/drizzle.service';
import { auditLogs } from '../drizzle/schema';
import { AuditLogMapper } from '../drizzle/mappers/audit-log.mapper';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleAuditLogRepository
  extends TenantScopedRepository
  implements AuditLogRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  // Takes the tenant explicitly instead of from context: login failures and
  // superadmin actions have to be logged with no tenant in context.
  async record(data: RecordAuditData): Promise<void> {
    await this.drizzle.db.insert(auditLogs).values({
      tenantId: data.tenantId,
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      before: data.before ?? null,
      after: data.after ?? null,
      ip: data.ip,
    });
  }

  async findOfTenant(limit = 50): Promise<AuditLog[]> {
    const rows = await this.drizzle.db
      .select()
      .from(auditLogs)
      .where(this.scope(auditLogs))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return rows.map(AuditLogMapper.toDomain);
  }
}
