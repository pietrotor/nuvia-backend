import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

export interface BranchProfessionalProps {
  tenantId: string;
  branchId: string;
  professionalId: string;
  // The only source of truth for when a professional works at this branch.
  weeklyHours: WeeklyHours;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BranchProfessional {
  public readonly tenantId: string;
  public readonly branchId: string;
  public readonly professionalId: string;
  public readonly weeklyHours: WeeklyHours;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: BranchProfessionalProps) {
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.professionalId = props.professionalId;
    this.weeklyHours = props.weeklyHours;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
