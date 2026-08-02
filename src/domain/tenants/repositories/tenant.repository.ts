import { Tenant } from '../entities/tenant.entity';
import { TenantStatus } from '../value-objects/tenant-status.vo';
import { Vertical } from '../value-objects/vertical.vo';
import { SendWindowConfig } from '../value-objects/send-window-config.vo';

export interface CreateTenantData {
  name: string;
  vertical: Vertical;
  timezone?: string;
  whatsappPhone?: string | null;
  plan?: string | null;
  sendWindowConfig?: SendWindowConfig | null;
}

export interface UpdateTenantData {
  name?: string;
  vertical?: Vertical;
  status?: TenantStatus;
  timezone?: string;
  whatsappPhone?: string | null;
  plan?: string | null;
  staticQrUrl?: string | null;
  paymentsEmail?: string | null;
  sendWindowConfig?: SendWindowConfig | null;
}

// Root table: no tenant_id, so this repository is not tenant-scoped. Callers must
// pass the id from the token, never one taken from the URL.
export interface TenantRepository {
  create(data: CreateTenantData): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findAll(): Promise<Tenant[]>;
  update(id: string, data: UpdateTenantData): Promise<Tenant | null>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export const TENANT_REPOSITORY = 'TenantRepository';
