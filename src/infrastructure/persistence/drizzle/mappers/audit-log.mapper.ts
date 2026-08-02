import { AuditAction, AuditLog } from '@domain/audit/entities/audit-log.entity';
import { AuditLogSchema } from '../schema/audit-log.schema';

export class AuditLogMapper {
  static toDomain(row: AuditLogSchema): AuditLog {
    return new AuditLog({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      action: row.action as AuditAction,
      entity: row.entity,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      ip: row.ip,
      createdAt: row.createdAt,
    });
  }
}
