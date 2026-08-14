import { BranchService } from '../entities/branch-service.entity';

export interface UpsertBranchServiceData {
  branchId: string;
  serviceId: string;
  priceOverrideAmount?: string | null;
  depositAmountOverrideAmount?: string | null;
  depositQrId?: string | null;
  isActive?: boolean;
}

export interface BranchServiceRepository {
  upsert(data: UpsertBranchServiceData): Promise<BranchService>;
  findByBranchAndService(
    branchId: string,
    serviceId: string,
  ): Promise<BranchService | null>;
  findByBranch(branchId: string): Promise<BranchService[]>;
  findActiveByBranch(branchId: string): Promise<BranchService[]>;
  deactivate(
    branchId: string,
    serviceId: string,
  ): Promise<BranchService | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const BRANCH_SERVICE_REPOSITORY = 'BranchServiceRepository';
