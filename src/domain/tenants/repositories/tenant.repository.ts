import { Tenant } from '../entities/tenant.entity';
import { TenantStatus } from '../value-objects/tenant-status.vo';

export interface CreateTenantData {
  name: string;
  timezone?: string;
  plan?: string | null;
  status?: TenantStatus;
}

export interface UpdateTenantData {
  name?: string;
  timezone?: string;
  plan?: string | null;
  status?: TenantStatus;
}

export interface TenantRepository {
  create(data: CreateTenantData): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findAll(): Promise<Tenant[]>;
  update(id: string, data: UpdateTenantData): Promise<Tenant | null>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export const TENANT_REPOSITORY = 'TenantRepository';
