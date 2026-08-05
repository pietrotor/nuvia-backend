import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

export interface ProfessionalProps {
  id: string;
  tenantId: string;
  name: string;
  weeklyHours: WeeklyHours;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Professional {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly weeklyHours: WeeklyHours;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: ProfessionalProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.weeklyHours = props.weeklyHours;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
