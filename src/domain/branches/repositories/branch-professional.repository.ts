import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { BranchProfessional } from '../entities/branch-professional.entity';

export interface UpsertBranchProfessionalData {
  branchId: string;
  professionalId: string;
  weeklyHours: WeeklyHours;
  isActive?: boolean;
}

export interface BranchProfessionalRepository {
  upsert(data: UpsertBranchProfessionalData): Promise<BranchProfessional>;
  findByBranchAndProfessional(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessional | null>;
  findByBranch(branchId: string): Promise<BranchProfessional[]>;
  findByProfessional(professionalId: string): Promise<BranchProfessional[]>;
  findActiveByBranch(branchId: string): Promise<BranchProfessional[]>;
  deactivate(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessional | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const BRANCH_PROFESSIONAL_REPOSITORY = 'BranchProfessionalRepository';
