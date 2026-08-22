export interface AppointmentNotificationSubscriptionProps {
  id: string;
  tenantId: string;
  contactId: string;
  professionalId: string | null;
  branchId: string | null;
  enabledAt: Date;
  disabledAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AppointmentNotificationSubscription {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly contactId: string;
  public readonly professionalId: string | null;
  public readonly branchId: string | null;
  public readonly enabledAt: Date;
  public readonly disabledAt: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentNotificationSubscriptionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.contactId = props.contactId;
    this.professionalId = props.professionalId;
    this.branchId = props.branchId;
    this.enabledAt = props.enabledAt;
    this.disabledAt = props.disabledAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isEnabled(): boolean {
    return this.disabledAt === null;
  }

  disable(now: Date): AppointmentNotificationSubscription {
    if (this.disabledAt) return this;
    return new AppointmentNotificationSubscription({
      ...this,
      disabledAt: now,
    });
  }

  enable(now: Date): AppointmentNotificationSubscription {
    if (!this.disabledAt) return this;
    return new AppointmentNotificationSubscription({
      ...this,
      enabledAt: now,
      disabledAt: null,
    });
  }

  coversProfessional(professionalId: string): boolean {
    return this.isEnabled() && this.professionalId === professionalId;
  }

  coversBranch(branchId: string): boolean {
    return this.isEnabled() && this.branchId === branchId;
  }
}
