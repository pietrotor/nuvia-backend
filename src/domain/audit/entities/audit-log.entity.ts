export enum AuditAction {
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  USER_CREATED = 'user_created',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_DEACTIVATED = 'user_deactivated',
  TENANT_CREATED = 'tenant_created',
  TENANT_UPDATED = 'tenant_updated',
  TENANT_DELETED = 'tenant_deleted',
  BUSINESS_CONFIG_UPDATED = 'business_config_updated',
  BUSINESS_CATEGORY_CHANGED = 'business_category_changed',
  PROFESSIONAL_CREATED = 'professional_created',
  PROFESSIONAL_UPDATED = 'professional_updated',
  SERVICE_CREATED = 'service_created',
  SERVICE_UPDATED = 'service_updated',
  SCHEDULE_BLOCK_CREATED = 'schedule_block_created',
  SCHEDULE_BLOCK_UPDATED = 'schedule_block_updated',
  APPOINTMENT_BOOKED = 'appointment_booked',
  APPOINTMENT_RESCHEDULED = 'appointment_rescheduled',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  APPOINTMENT_ATTENDED = 'appointment_attended',
  APPOINTMENT_NO_SHOW = 'appointment_no_show',
  CONVERSATION_BOT_PAUSED = 'conversation_bot_paused',
  CONVERSATION_BOT_RESUMED = 'conversation_bot_resumed',
  CONVERSATION_MANUAL_REPLY = 'conversation_manual_reply',
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
