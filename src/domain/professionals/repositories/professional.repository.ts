import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { Professional } from '../entities/professional.entity';

export interface CreateProfessionalData {
  name: string;
  weeklyHours: WeeklyHours;
  isActive?: boolean;
}

export interface UpdateProfessionalData {
  name?: string;
  weeklyHours?: WeeklyHours;
  isActive?: boolean;
}

export interface ProfessionalRepository {
  create(data: CreateProfessionalData): Promise<Professional>;
  findById(id: string): Promise<Professional | null>;
  findAll(): Promise<Professional[]>;
  update(
    id: string,
    data: UpdateProfessionalData,
  ): Promise<Professional | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const PROFESSIONAL_REPOSITORY = 'ProfessionalRepository';
