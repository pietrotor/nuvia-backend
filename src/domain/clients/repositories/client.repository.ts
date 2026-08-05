import { Client } from '../entities/client.entity';

export interface CreateClientData {
  name: string;
  phoneE164: string;
  notes?: string | null;
}

export interface ClientRepository {
  create(data: CreateClientData): Promise<Client>;
  findOrCreate(data: CreateClientData): Promise<Client>;
  findById(id: string): Promise<Client | null>;
  findByPhone(phoneE164: string): Promise<Client | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const CLIENT_REPOSITORY = 'ClientRepository';
