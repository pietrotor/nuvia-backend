export enum AuditAction {
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  USER_CREATED = 'user_created',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_DEACTIVATED = 'user_deactivated',
  TENANT_CREATED = 'tenant_created',
  TENANT_UPDATED = 'tenant_updated',
  TENANT_DELETED = 'tenant_deleted',
  SUPERADMIN_ACCESS = 'superadmin_access',
}

export interface AuditLogProps {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  createdAt?: Date;
}

export class AuditLog {
  public readonly id: string;
  public readonly tenantId: string | null;
  public readonly userId: string | null;
  public readonly action: AuditAction;
  public readonly entity: string;
  public readonly entityId: string | null;
  public readonly before: unknown;
  public readonly after: unknown;
  public readonly ip: string | null;
  public readonly createdAt?: Date;

  constructor(props: AuditLogProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.action = props.action;
    this.entity = props.entity;
    this.entityId = props.entityId ?? null;
    this.before = props.before ?? null;
    this.after = props.after ?? null;
    this.ip = props.ip ?? null;
    this.createdAt = props.createdAt;
  }
}
