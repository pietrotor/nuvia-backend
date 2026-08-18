import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { BranchProfessionalServiceWindow } from '../entities/branch-professional-service-window.entity';

export interface UpsertBranchProfessionalServiceWindowData {
  branchId: string;
  professionalId: string;
  serviceId: string;
  weeklyHours: WeeklyHours;
  isActive?: boolean;
}

export interface BranchProfessionalServiceWindowRepository {
  upsert(
    data: UpsertBranchProfessionalServiceWindowData,
  ): Promise<BranchProfessionalServiceWindow>;
  findByAssignmentAndService(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null>;
  findActiveByAssignmentAndService(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null>;
  findByAssignment(
    branchId: string,
    professionalId: string,
  ): Promise<BranchProfessionalServiceWindow[]>;
  deactivate(
    branchId: string,
    professionalId: string,
    serviceId: string,
  ): Promise<BranchProfessionalServiceWindow | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const BRANCH_PROFESSIONAL_SERVICE_WINDOW_REPOSITORY =
  'BranchProfessionalServiceWindowRepository';
