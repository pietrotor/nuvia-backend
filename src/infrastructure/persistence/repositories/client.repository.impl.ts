import { Injectable } from '@nestjs/common';
import { count, eq, ilike, inArray, or } from 'drizzle-orm';

import {
  ClientRepository,
  CreateClientData,
  SearchClientsCriteria,
  UpdateClientData,
} from '@domain/clients/repositories/client.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { clients } from '../drizzle/schema/client.schema';
import { ClientMapper } from '../drizzle/mappers/client.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

// Without this a client typing "50%" would match every row, and "_" any character.
const escapeLikePattern = (term: string): string =>
  term.replace(/[\\%_]/g, (char) => `\\${char}`);

@Injectable()
export class DrizzleClientRepository
  extends TenantScopedRepository
  implements ClientRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateClientData): Promise<Client> {
    try {
      const [created] = await this.insertInto(clients, {
        name: data.name ?? null,
        phoneE164: data.phoneE164 ?? null,
        whatsappProfileName: data.whatsappProfileName ?? null,
        email: data.email,
        birthDate: data.birthDate,
        identificationType: data.identificationType,
        identificationNumber: data.identificationNumber,
        address: data.address,
        notes: data.notes,
      });
      return ClientMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Client | null> {
    const [row] = await this.selectFrom(clients, eq(clients.id, id));
    return row ? ClientMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Client[]> {
    if (ids.length === 0) return [];
    const rows = await this.selectFrom(clients, inArray(clients.id, ids));
    return rows.map(ClientMapper.toDomain);
  }

  async findOrCreate(data: CreateClientData): Promise<Client> {
    if (data.phoneE164) {
      const existing = await this.findByPhone(data.phoneE164);
      if (existing) {
        if (
          data.whatsappProfileName &&
          data.whatsappProfileName !== existing.whatsappProfileName
        ) {
          return (
            (await this.update(existing.id, {
              whatsappProfileName: data.whatsappProfileName,
            })) ?? existing
          );
        }
        return existing;
      }
    }

    try {
      return await this.create(data);
    } catch (error) {
      if (data.phoneE164) {
        const raced = await this.findByPhone(data.phoneE164);
        if (raced) return raced;
      }
      throw error;
    }
  }

  async findByPhone(phoneE164: string): Promise<Client | null> {
    const [row] = await this.selectFrom(
      clients,
      eq(clients.phoneE164, phoneE164),
    );
    return row ? ClientMapper.toDomain(row) : null;
  }

  // The term is matched in SQL and the limit is applied by the database: the client book
  // of a busy centre has no reason to travel so a combobox can filter it in memory.
  async search(criteria: SearchClientsCriteria) {
    const term = criteria.term?.trim();
    const patterns = new Set<string>();
    if (term) {
      patterns.add(`%${escapeLikePattern(term)}%`);
    }
    for (const searchTerm of criteria.searchTerms ?? []) {
      const trimmed = searchTerm.trim();
      if (!trimmed) continue;
      patterns.add(`%${escapeLikePattern(trimmed)}%`);
    }

    const phoneConditions = [...patterns].map((pattern) =>
      ilike(clients.phoneE164, pattern),
    );
    const namePattern = term ? `%${escapeLikePattern(term)}%` : undefined;
    const where = this.scope(
      clients,
      patterns.size > 0
        ? or(
            namePattern ? ilike(clients.name, namePattern) : undefined,
            phoneConditions.length > 0 ? or(...phoneConditions) : undefined,
          )
        : undefined,
    );

    const [countRow] = await this.drizzle.db
      .select({ total: count() })
      .from(clients)
      .where(where);

    const rows = await this.drizzle.db
      .select()
      .from(clients)
      .where(where)
      .orderBy(clients.name)
      .limit(criteria.limit)
      .offset(criteria.offset);

    return {
      total: Number(countRow?.total ?? 0),
      rows: rows.map(ClientMapper.toDomain),
    };
  }

  async update(id: string, data: UpdateClientData): Promise<Client | null> {
    try {
      const [updated] = await this.updateIn(clients, data, eq(clients.id, id));
      return updated ? ClientMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(clients);
  }
}
