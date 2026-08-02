import { TenantStatus } from '../value-objects/tenant-status.vo';
import { Vertical } from '../value-objects/vertical.vo';
import { SendWindowConfig } from '../value-objects/send-window-config.vo';

export interface TenantProps {
  id: string;
  name: string;
  vertical: Vertical;
  status: TenantStatus;
  timezone: string;
  verticalTemplateId?: string | null;
  sendWindowConfig?: SendWindowConfig | null;
  whatsappPhone?: string | null;
  plan?: string | null;
  staticQrUrl?: string | null;
  paymentsEmail?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Tenant {
  public readonly id: string;
  public readonly name: string;
  public readonly vertical: Vertical;
  public readonly status: TenantStatus;
  public readonly timezone: string;
  public readonly verticalTemplateId: string | null;
  public readonly sendWindowConfig: SendWindowConfig | null;
  public readonly whatsappPhone: string | null;
  public readonly plan: string | null;
  public readonly staticQrUrl: string | null;
  public readonly paymentsEmail: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: TenantProps) {
    this.id = props.id;
    this.name = props.name;
    this.vertical = props.vertical;
    this.status = props.status;
    this.timezone = props.timezone;
    this.verticalTemplateId = props.verticalTemplateId ?? null;
    this.sendWindowConfig = props.sendWindowConfig ?? null;
    this.whatsappPhone = props.whatsappPhone ?? null;
    this.plan = props.plan ?? null;
    this.staticQrUrl = props.staticQrUrl ?? null;
    this.paymentsEmail = props.paymentsEmail ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isSuspended(): boolean {
    return this.status === TenantStatus.SUSPENDED;
  }

  canOperate(): boolean {
    return !this.isSuspended();
  }

  canSendMessages(): boolean {
    return this.canOperate() && this.whatsappPhone !== null;
  }

  isReadyToBill(): boolean {
    return this.canSendMessages() && this.staticQrUrl !== null;
  }
}
