import { Professional } from '../entities/professional.entity';

export interface CreateProfessionalData {
  name: string;
  isActive?: boolean;
}

export interface UpdateProfessionalData {
  name?: string;
  isActive?: boolean;
  avatarStorageKey?: string | null;
  avatarMimeType?: string | null;
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
