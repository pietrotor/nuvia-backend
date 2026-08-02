import { AuditAction, AuditLog } from '../entities/audit-log.entity';

export interface RecordAuditData {
  tenantId: string | null;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export interface AuditLogRepository {
  record(data: RecordAuditData): Promise<void>;
  findOfTenant(limit?: number): Promise<AuditLog[]>;
}

export const AUDIT_LOG_REPOSITORY = 'AuditLogRepository';
