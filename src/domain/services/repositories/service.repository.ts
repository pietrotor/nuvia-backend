import { Currency } from '@domain/common/value-objects/currency.vo';
import { Service } from '../entities/service.entity';

export interface CreateServiceData {
  name: string;
  durationMinutes: number;
  currency: Currency;
  price: string;
  requiresDeposit?: boolean;
  depositAmount?: string | null;
  depositPercent?: number | null;
  professionalIds: string[];
  isActive?: boolean;
}

export interface UpdateServiceData {
  name?: string;
  durationMinutes?: number;
  currency?: Currency;
  price?: string;
  requiresDeposit?: boolean;
  depositAmount?: string | null;
  depositPercent?: number | null;
  professionalIds?: string[];
  isActive?: boolean;
}

export interface ServiceRepository {
  create(data: CreateServiceData): Promise<Service>;
  findById(id: string): Promise<Service | null>;
  findAll(): Promise<Service[]>;
  update(id: string, data: UpdateServiceData): Promise<Service | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const SERVICE_REPOSITORY = 'ServiceRepository';
