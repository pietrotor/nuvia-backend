export interface ScheduleBlockProps {
  id: string;
  tenantId: string;
  branchId?: string | null;
  professionalId: string | null;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ScheduleBlock {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly professionalId: string | null;
  public readonly startsAt: Date;
  public readonly endsAt: Date;
  public readonly reason: string | null;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ScheduleBlockProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId ?? null;
    this.professionalId = props.professionalId;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.reason = props.reason;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
