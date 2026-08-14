import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

export interface BranchProps {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  address: string | null;
  mapsUrl: string | null;
  phone: string | null;
  weeklyHours: WeeklyHours;
  // Null means inherit Tenant.timezone.
  timezone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Branch {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly slug: string;
  public readonly address: string | null;
  public readonly mapsUrl: string | null;
  public readonly phone: string | null;
  public readonly weeklyHours: WeeklyHours;
  public readonly timezone: string | null;
  public readonly isPrimary: boolean;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: BranchProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.slug = props.slug;
    this.address = props.address;
    this.mapsUrl = props.mapsUrl;
    this.phone = props.phone;
    this.weeklyHours = props.weeklyHours;
    this.timezone = props.timezone;
    this.isPrimary = props.isPrimary;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
