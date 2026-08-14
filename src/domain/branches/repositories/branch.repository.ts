import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';

import { Branch } from '../entities/branch.entity';

export interface CreateBranchData {
  name: string;
  slug: string;
  address?: string | null;
  mapsUrl?: string | null;
  phone?: string | null;
  weeklyHours: WeeklyHours;
  timezone?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateBranchData {
  name?: string;
  slug?: string;
  address?: string | null;
  mapsUrl?: string | null;
  phone?: string | null;
  weeklyHours?: WeeklyHours;
  timezone?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface BranchRepository {
  create(data: CreateBranchData): Promise<Branch>;
  findById(id: string): Promise<Branch | null>;
  findBySlug(slug: string): Promise<Branch | null>;
  findAll(): Promise<Branch[]>;
  findActive(): Promise<Branch[]>;
  findPrimary(): Promise<Branch | null>;
  update(id: string, data: UpdateBranchData): Promise<Branch | null>;
  countActive(): Promise<number>;
  deleteAllUnscoped(): Promise<void>;
}

export const BRANCH_REPOSITORY = 'BranchRepository';
