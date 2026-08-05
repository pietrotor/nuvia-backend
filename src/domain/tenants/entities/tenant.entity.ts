import { TenantStatus } from '../value-objects/tenant-status.vo';

export interface TenantProps {
  id: string;
  name: string;
  status: TenantStatus;
  timezone: string;
  plan?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Tenant {
  public readonly id: string;
  public readonly name: string;
  public readonly status: TenantStatus;
  public readonly timezone: string;
  public readonly plan: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: TenantProps) {
    this.id = props.id;
    this.name = props.name;
    this.status = props.status;
    this.timezone = props.timezone;
    this.plan = props.plan ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isSuspended(): boolean {
    return this.status === TenantStatus.SUSPENDED;
  }

  canOperate(): boolean {
    return !this.isSuspended();
  }
}
