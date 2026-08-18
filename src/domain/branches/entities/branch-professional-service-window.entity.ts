import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

export interface BranchProfessionalServiceWindowProps {
  tenantId: string;
  branchId: string;
  professionalId: string;
  serviceId: string;
  weeklyHours: WeeklyHours;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Optional advanced schedule: when this professional offers this service at this
 * branch. Absence of a row means the full BranchProfessional ∩ Branch hours apply.
 */
export class BranchProfessionalServiceWindow {
  public readonly tenantId: string;
  public readonly branchId: string;
  public readonly professionalId: string;
  public readonly serviceId: string;
  public readonly weeklyHours: WeeklyHours;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: BranchProfessionalServiceWindowProps) {
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.professionalId = props.professionalId;
    this.serviceId = props.serviceId;
    this.weeklyHours = props.weeklyHours;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
