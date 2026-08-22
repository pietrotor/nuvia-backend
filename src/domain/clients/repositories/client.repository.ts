import { Client } from '../entities/client.entity';

export interface CreateClientData {
  name?: string | null;
  phoneE164?: string | null;
  whatsappProfileName?: string | null;
  email?: string | null;
  birthDate?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateClientData {
  name?: string | null;
  phoneE164?: string | null;
  whatsappProfileName?: string | null;
  email?: string | null;
  birthDate?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface SearchClientsCriteria {
  // Matches name or phone. Absent means the first page of the whole book.
  term?: string;
  searchTerms?: string[];
  limit: number;
  offset: number;
}

export interface ClientSearchResult {
  rows: Client[];
  total: number;
}

export interface ClientRepository {
  create(data: CreateClientData): Promise<Client>;
  findOrCreate(data: CreateClientData): Promise<Client>;
  findById(id: string): Promise<Client | null>;
  findByIds(ids: string[]): Promise<Client[]>;
  findByPhone(phoneE164: string): Promise<Client | null>;
  search(criteria: SearchClientsCriteria): Promise<ClientSearchResult>;
  update(id: string, data: UpdateClientData): Promise<Client | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const CLIENT_REPOSITORY = 'ClientRepository';
