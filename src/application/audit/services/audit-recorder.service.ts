import { Inject, Injectable } from '@nestjs/common';

import {
  AUDIT_LOG_REPOSITORY,
  AuditLogRepository,
} from '@domain/audit/repositories/audit-log.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  tenantId?: string | null;
  userId?: string | null;
}

@Injectable()
export class AuditRecorder {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: AuditLogRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogRepository.record({
        tenantId: entry.tenantId ?? this.tenantContext.tenantId,
        userId: entry.userId ?? this.tenantContext.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before,
        after: entry.after,
        ip: entry.ip,
      });
    } catch (error) {
      // A failed audit write must not roll back the business operation it describes.
      this.logger.error(
        `Could not write audit entry ${entry.action}`,
        error instanceof Error ? error.stack : undefined,
        'AuditRecorder',
      );
    }
  }
}
