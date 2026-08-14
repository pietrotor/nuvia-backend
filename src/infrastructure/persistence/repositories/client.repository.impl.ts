import { Injectable } from '@nestjs/common';
import { count, eq, ilike, or } from 'drizzle-orm';

import {
  ClientRepository,
  CreateClientData,
  SearchClientsCriteria,
  UpdateClientData,
} from '@domain/clients/repositories/client.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
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
        name: data.name,
        phoneE164: data.phoneE164,
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

  async findOrCreate(data: CreateClientData): Promise<Client> {
    const [created] = await this.drizzle.db
      .insert(clients)
      .values({ ...data, tenantId: this.tenantId })
      .onConflictDoNothing({
        target: [clients.tenantId, clients.phoneE164],
      })
      .returning();
    if (created) return ClientMapper.toDomain(created);

    const existing = await this.findByPhone(data.phoneE164);
    if (!existing) {
      throw new InternalError(ErrorCode.INTERNAL_ERROR);
    }
    return existing;
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
    const pattern = term ? `%${escapeLikePattern(term)}%` : undefined;
    const where = this.scope(
      clients,
      pattern
        ? or(ilike(clients.name, pattern), ilike(clients.phoneE164, pattern))
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
