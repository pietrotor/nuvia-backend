export interface BranchServiceProps {
  tenantId: string;
  branchId: string;
  serviceId: string;
  // Amount only: currency comes from the catalog Service when resolving Money.
  priceOverrideAmount: string | null;
  depositAmountOverrideAmount: string | null;
  depositQrId: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class BranchService {
  public readonly tenantId: string;
  public readonly branchId: string;
  public readonly serviceId: string;
  public readonly priceOverrideAmount: string | null;
  public readonly depositAmountOverrideAmount: string | null;
  public readonly depositQrId: string | null;
  public readonly isActive: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: BranchServiceProps) {
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.serviceId = props.serviceId;
    this.priceOverrideAmount = props.priceOverrideAmount;
    this.depositAmountOverrideAmount = props.depositAmountOverrideAmount;
    this.depositQrId = props.depositQrId;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
